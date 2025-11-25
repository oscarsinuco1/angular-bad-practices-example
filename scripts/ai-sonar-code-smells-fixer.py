import os
import json
import subprocess
import re
import time
import sys
import threading
import itertools
import toml
import google.generativeai as genai

SONAR_API_URL = "https://sonarcloud.io/api/issues/search"
SONAR_TOKEN = "4cc2e3525b35bb2643a7646b04c5127b0b89da5f"  # Note: In production, use environment variables
PROJECT_KEY = "oscarsinuco1_angular-bad-practices-example"
BRANCH_NAME = "sonar-fix"

# Configure Gemini
genai.configure(api_key='AIzaSyBmLydzon_Vjs0wTVrQovuHpyuEkj9YIWg')
gemini_model = genai.GenerativeModel('gemini-2.5-pro')  # Using stable version

# Debug mode - save AI responses for review instead of applying
DEBUG_MODE = False

def print_progress_bar(current, total, description=""):
    bar_length = 30
    percent = min(current / total * 100, 100)
    filled_length = int(bar_length * percent / 100)
    bar = '█' * filled_length + '░' * (bar_length - filled_length)
    sys.stdout.write(f'\rProgress: [{bar}] {percent:.1f}% - {description}')
    sys.stdout.flush()
    if percent >= 100:
        print()  # New line when complete

def spinner(stop_event, message="Processing"):
    spinner_chars = itertools.cycle(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'])
    while not stop_event.is_set():
        sys.stdout.write(f'\r{message} {next(spinner_chars)}')
        sys.stdout.flush()
        time.sleep(0.1)
    sys.stdout.write('\r' + ' ' * (len(message) + 2) + '\r')  # Clear the line

def fetch_code_smells():
    """Fetch code smells from SonarCloud API"""
    try:
        cmd = [
            'curl', '-u', f'{SONAR_TOKEN}:', SONAR_API_URL,
            '-d', f'componentKeys={PROJECT_KEY}',
            '-d', 'types=CODE_SMELL',
            '-d', 'ps=500'
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f'Failed to fetch code smells: {result.stderr}')
            return []
        return json.loads(result.stdout)
    except Exception as e:
        print(f'Error fetching code smells: {e}')
        return []

def parse_issues(api_response):
    """Parse API response and extract issues"""
    issues = api_response.get('issues', [])
    parsed_issues = []
    for issue in issues:
        parsed_issue = {
            'rule': issue.get('rule'),
            'component': issue.get('component'),
            'line': issue.get('line'),
            'textRange': issue.get('textRange'),
            'message': issue.get('message'),
            'key': issue.get('key')  # For verification
        }
        parsed_issues.append(parsed_issue)
    return parsed_issues

def get_repo_structure_and_content():
    """Get the complete repository structure and content under src/"""
    try:
        # Get tree structure
        result = subprocess.run(['tree', 'src/', '-I', 'node_modules'], capture_output=True, text=True)
        tree_structure = result.stdout if result.returncode == 0 else "Tree command failed"

        # Get all files under src/
        repo_content = {}
        for root, dirs, files in os.walk('src'):
            # Skip node_modules if it exists
            dirs[:] = [d for d in dirs if d != 'node_modules']
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    repo_content[file_path] = content
                except Exception as e:
                    repo_content[file_path] = f"Error reading file: {e}"

        return tree_structure, repo_content
    except Exception as e:
        return f"Error getting repo structure: {e}", {}

def generate_fixes_with_ai(issues, grouped_issues, files_to_fix, last_error):
    # Get complete repo structure and content for each iteration
    tree_structure, repo_content = get_repo_structure_and_content()

    full_prompt = """
You are an expert Angular 20 Code Quality Fixer.
The following Angular 20 application has code smells detected by SonarCloud.
Please fix the code smells by providing corrected component/service files.
Focus on resolving the specific issues mentioned in the code smells.

Angular 20 Code Quality Guidelines:
- Fix code smells according to SonarCloud rules
- Maintain functionality while improving code quality
- Follow Angular best practices
- Ensure TypeScript strict mode compliance
- Use proper error handling and null safety

Project Config:
- TypeScript: strict mode enabled, target ES2022.
- Angular: strict templates, injection parameters, etc.

Output the response only as a Python list of strings with the complete file contents for the fixed files, in the SAME ORDER as the unique files listed above (one entry per file, even if multiple issues in the same file)

Example:
[
  "import { ... } from ...\\n...",
  "..."
]

REMEMBER: response only contains the Python list, not text, not recommendations, only the list

COMPLETE APPLICATION CONTEXT:
"""

    # Add tree structure
    full_prompt += "\n\n=== PROJECT STRUCTURE ===\n" + tree_structure

    # Add all file contents
    full_prompt += "\n\n=== ALL FILES CONTENT ===\n"
    for file_path, content in repo_content.items():
        full_prompt += f"\n--- {file_path} ---\n{content}\n"

    # Add files and their issues that need fixing
    full_prompt += "\n\n=== FILES TO FIX ===\n"
    for i, file_path in enumerate(files_to_fix):
        full_prompt += f"\n\n--- File {i+1}: {file_path} ---\n"
        file_issues = grouped_issues[file_path]
        for j, issue in enumerate(file_issues):
            full_prompt += f"Issue {j+1}: Line {issue['line']} - {issue['message']} (Rule: {issue['rule']})\n"


    if last_error:
        full_prompt += """

PREVIOUS ATTEMPT FAILED.
The following errors occurred when running the tests:
""" + last_error + """

Please FIX the code to resolve these errors and ensure tests pass.
"""

    # Save the prompt
    prompt_filename = 'ai_prompt_{}.txt'.format(int(time.time()))
    with open(prompt_filename, 'w') as f:
        f.write(full_prompt)
    print('Prompt saved to {}'.format(prompt_filename))

    print('Generating tests with AI...')

    generated_text = None

    # Try Gemini
    if generated_text is None:
        try:
            print('Trying Gemini...')
            response = gemini_model.generate_content(full_prompt)
            generated_text = response.text.strip()
            print('Gemini response received')
        except Exception as e:
            print(f'Gemini failed: {e}')
            raise Exception('AI provider failed')

    # Parse the response (AI is outputting Python-like syntax)
    try:
        import ast
        # Strip markdown code blocks if present
        import re
        # Remove ``` and ``` with optional language specifier
        generated_text = re.sub(r'^```(?:toml|python)?\s*', '', generated_text)
        generated_text = re.sub(r'```\s*$', '', generated_text)
        generated_text = generated_text.strip()

        print(f"Attempting to parse response: {generated_text[:200]}...")
        # Extract the list part if it's component_codes = [...]
        if 'component_codes =' in generated_text:
            list_part = generated_text.split('component_codes =', 1)[1].strip()
            component_codes = ast.literal_eval(list_part)
        else:
            # Try to parse as direct list
            component_codes = ast.literal_eval(generated_text)
        if not isinstance(component_codes, list):
            component_codes = [str(component_codes)]
        print(f"Successfully parsed {len(component_codes)} component codes")
    except Exception as e:
        print(f"Parsing failed: {e}")
        print(f"Raw response start: {generated_text[:500]}...")
        print(f"Raw response end: {generated_text[-500:]}...")
        # Fallback
        component_codes = [generated_text]

    return component_codes

def run_tests():
    stop_spinner = threading.Event()
    spinner_thread = threading.Thread(target=spinner, args=(stop_spinner, "Running tests"))
    spinner_thread.start()

    try:
        result = subprocess.run(['ng', 'test', '--watch=false', '--browsers=ChromeHeadlessCI', '--code-coverage', '--reporters=progress,junit,kjhtml'], capture_output=True, text=True, timeout=300)
        if result.returncode == 0:
            return True, None
        else:
            # Combine stdout and stderr, prioritize stderr for errors
            error_output = (result.stderr or '') + (result.stdout or '')
            # Look for test failure patterns in the output
            lines = error_output.split('\n')
            # Filter for lines that contain test failures
            failure_lines = [line for line in lines if any(keyword in line.lower() for keyword in [
                'failed', 'error', 'expected', '✗', 'failed expectations', 'spec has no expectations'
            ])]
            # If we found specific failures, use those
            if failure_lines:
                error = '\n'.join(failure_lines)  # All failure lines as string
            else:
                # Fallback to general error output
                error = error_output[-3000:] if len(error_output) > 3000 else error_output
            return False, error
    except subprocess.TimeoutExpired:
        return False, "Tests timed out after 5 minutes"
    except Exception as e:
        return False, f"Test execution error: {str(e)}"
    finally:
        stop_spinner.set()
        spinner_thread.join()
        print()  # New line after spinner

def convert_issues_to_toml(issues):
    """Convert issues to TOML format for AI"""
    toml_data = []
    for issue in issues:
        toml_issue = {
            'rule': issue['rule'],
            'component': issue['component'],
            'line': issue['line'],
            'textRange': issue['textRange'],
            'message': issue['message']
        }
        toml_data.append(toml.dumps(toml_issue))
    return toml_data

def create_and_push_branch():
    """Create sonar-fix branch and push changes"""
    try:
        # Check if branch exists, delete if it does
        result = subprocess.run(['git', 'branch', '-D', BRANCH_NAME], capture_output=True)
        # Create new branch
        subprocess.run(['git', 'checkout', '-b', BRANCH_NAME], check=True)
        # Add all changes
        subprocess.run(['git', 'add', '.'], check=True)
        # Commit
        subprocess.run(['git', 'commit', '-m', 'fix: AI-generated code smell fixes'], check=True)
        # Push
        subprocess.run(['git', 'push', '-u', 'origin', BRANCH_NAME], check=True)
        print(f'Pushed changes to branch {BRANCH_NAME}')
    except subprocess.CalledProcessError as e:
        print(f'Git operation failed: {e}')
        raise

def verify_issues_resolved(original_issues):
    """Poll SonarCloud API until issues are resolved"""
    print('Waiting for SonarCloud to update issues...')
    max_polls = 30  # 5 minutes with 10s intervals
    poll_count = 0

    while poll_count < max_polls:
        try:
            api_response = fetch_code_smells()
            current_issues = parse_issues(api_response)
            current_keys = {issue['key'] for issue in current_issues}

            resolved = True
            for orig_issue in original_issues:
                if orig_issue['key'] in current_keys:
                    # Check if status is CLOSED
                    for curr_issue in current_issues:
                        if curr_issue['key'] == orig_issue['key']:
                            if curr_issue.get('status') != 'CLOSED':
                                resolved = False
                                break
                    if not resolved:
                        break
                # If issue not in current, assume resolved

            if resolved:
                print('All code smells resolved!')
                return True

            print(f'Issues not yet resolved, waiting... (poll {poll_count + 1}/{max_polls})')
            time.sleep(10)
            poll_count += 1

        except Exception as e:
            print(f'Error during verification: {e}')
            time.sleep(10)
            poll_count += 1

    print('Verification timeout. Issues may not be fully resolved.')
    return False

def group_issues_by_file(issues):
    """Group issues by component (file)"""
    from collections import defaultdict
    grouped = defaultdict(list)
    for issue in issues:
        file_path = issue['component'].replace(f'{PROJECT_KEY}:', '')
        grouped[file_path].append(issue)
    return grouped

def check_code_smells_and_fix():
    print('Fetching code smells from SonarCloud...')
    api_response = fetch_code_smells()
    if not api_response:
        print('No code smells found or failed to fetch.')
        return

    issues = parse_issues(api_response)
    if not issues:
        print('No code smells to fix.')
        return

    print(f'Found {len(issues)} code smells to fix.')

    # Group issues by file
    grouped_issues = group_issues_by_file(issues)
    print(f'Issues grouped into {len(grouped_issues)} files.')

    print('Running initial tests...')
    success, error = run_tests()
    if not success:
        print('Initial tests failed:', error)
        exit(1)
    print('Initial tests passed.')

    max_iterations = 10
    iteration = 0

    while iteration < max_iterations and grouped_issues:
        print(f'\nIteration {iteration + 1}: Fixing issues in {len(grouped_issues)} files')

        MAX_RETRIES = 5
        current_retry = 0
        last_error = ''
        success = False

        while current_retry < MAX_RETRIES and not success:
            print(f' - Attempt {current_retry + 1}/{MAX_RETRIES}...')

            try:
                # Convert grouped issues to list for AI
                files_to_fix = list(grouped_issues.keys())
                issues_list = []
                for file_path in files_to_fix:
                    issues_list.extend(grouped_issues[file_path])

                component_codes = generate_fixes_with_ai(issues_list, grouped_issues, files_to_fix, last_error)

                if DEBUG_MODE:
                    response_data = {
                        'component_codes': component_codes,
                        'files': files_to_fix,
                        'issues': issues_list
                    }
                    response_filename = f'ai_response_{int(time.time())}.json'
                    with open(response_filename, 'w') as f:
                        json.dump(response_data, f, indent=2)
                    print(f'DEBUG MODE: AI response saved to {response_filename} for review')
                    return

                print(f"About to apply fixes to {len(component_codes)} files")
                for i, file_path in enumerate(files_to_fix):
                    if i < len(component_codes) and component_codes[i]:
                        print(f'Applying fix to {file_path}...')
                        with open(file_path, 'w') as f:
                            f.write(component_codes[i])

                print('Running tests...')
                success, last_error = run_tests()
                if success:
                    print('Tests passed!')
                else:
                    print('Tests failed, retrying...')

            except Exception as e:
                print('Error in fix generation/verification:', e)
                last_error = str(e)

            current_retry += 1

        if not success:
            print('Failed to generate passing fixes after retries.')
            exit(1)

        # After successful iteration, re-fetch issues to see progress
        print('Re-fetching issues to check progress...')
        api_response = fetch_code_smells()
        issues = parse_issues(api_response)
        if not issues:
            print('All issues resolved!')
            break

        # Re-group remaining issues
        grouped_issues = group_issues_by_file(issues)

        iteration += 1

    if grouped_issues:
        remaining_count = sum(len(issues) for issues in grouped_issues.values())
        print(f'Still {remaining_count} issues remaining in {len(grouped_issues)} files after max iterations.')
    else:
        print('All code smells fixed locally.')

    # Now push and verify
    print('Creating branch and pushing changes...')
    create_and_push_branch()

    print('Verifying with SonarCloud...')
    original_issues = parse_issues(fetch_code_smells())  # Re-fetch to get keys
    verify_issues_resolved(original_issues)

    print('Process completed.')

if __name__ == '__main__':
    check_code_smells_and_fix()