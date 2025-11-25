import os
import json
import subprocess
import re
import time
import sys
import threading
import itertools
import toml
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()

SONAR_API_URL = "https://sonarcloud.io/api/issues/search"
SONAR_TOKEN = os.getenv('SONAR_TOKEN')  # Fallback for local testing
PROJECT_KEY = "oscarsinuco1_angular-bad-practices-example"
BRANCH_NAME = "sonar-fix"

# Configure Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')  # Fallback for local testing
genai.configure(api_key=GEMINI_API_KEY)
# GEMINI_MODELS = ['gemini-3-pro', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']
GEMINI_MODELS = ['gemini-3-pro', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro']

# Debug mode - save AI responses for review instead of applying
DEBUG_MODE = False

# CI mode - skip git operations when running in CI
CI_MODE = os.getenv('CI') == 'true'

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

def fetch_code_smells(branch=None):
    """Fetch code smells from SonarCloud API"""
    try:
        cmd = [
            'curl', '-u', f'{SONAR_TOKEN}:', SONAR_API_URL,
            '-d', f'componentKeys={PROJECT_KEY}',
            '-d', 'types=CODE_SMELL',
            '-d', 'ps=500'
        ]
        if branch:
            cmd.extend(['-d', f'branch={branch}'])
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f'Failed to fetch code smells: {result.stderr}')
            return []
        return json.loads(result.stdout)
    except Exception as e:
        print(f'Error fetching code smells: {e}')
        return []

def fetch_coverage(branch=None):
    """Fetch coverage percentage from SonarCloud API"""
    try:
        measures_url = "https://sonarcloud.io/api/measures/component"
        cmd = [
            'curl', '-u', f'{SONAR_TOKEN}:', measures_url,
            '-d', f'component={PROJECT_KEY}',
            '-d', 'metricKeys=coverage'
        ]
        if branch:
            cmd.extend(['-d', f'branch={branch}'])
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f'Failed to fetch coverage: {result.stderr}')
            return None
        data = json.loads(result.stdout)
        measures = data.get('component', {}).get('measures', [])
        for measure in measures:
            if measure['metric'] == 'coverage':
                return float(measure['value'])
        return None
    except Exception as e:
        print(f'Error fetching coverage: {e}')
        return None

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

def generate_fixes_with_ai(issues, grouped_issues, files_to_fix, last_error, initial_error='', failed_models=None):
    if failed_models is None:
        failed_models = set()
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
- ONLY modify application source files in src/app/ - do not modify configuration files like karma.conf.js, angular.json, package.json, or any other config files

Project Config:
- TypeScript: strict mode enabled, target ES2022.
- Angular: strict templates, injection parameters, etc.

Output the response only as a Python dict where keys are the file paths (exactly as listed above) and values are the complete fixed file contents as strings.

Example:
{
  "src/app/components/component-a/component-a.component.scss": "/* Fixed content */",
  "src/app/components/component-b/component-b.component.ts": "import { ... } from ...\\n..."
}

REMEMBER: response only contains the Python dict, not text, not recommendations, only the dict

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


    if initial_error:
        full_prompt += """

INITIAL BUILD/TEST ERRORS.
The following errors occurred in the initial build/test run:
""" + initial_error + """

Please fix these compilation and test errors first, then address the code smells.
"""

    if last_error:
        full_prompt += """

PREVIOUS ATTEMPT FAILED.
The following errors occurred when running the tests:
""" + last_error + """

Please FIX the code to resolve these errors and ensure tests pass.
"""

    # Save the prompt (for debugging)
    if DEBUG_MODE:
        prompt_filename = 'ai_prompt_{}.txt'.format(int(time.time()))
        with open(prompt_filename, 'w') as f:
            f.write(full_prompt)
        print('Prompt saved to {}'.format(prompt_filename))

    print('Generating tests with AI...')

    generated_text = None

    # Try Gemini models in order, skipping failed ones
    for model_name in GEMINI_MODELS:
        if model_name in failed_models:
            print(f'Skipping previously failed model {model_name}')
            continue
        if generated_text is None:
            try:
                print(f'Trying Gemini {model_name}...')
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(full_prompt)
                generated_text = response.text.strip()
                print(f'Gemini {model_name} response received')
                break  # Success, stop trying
            except Exception as e:
                error_str = str(e)
                print(f'Gemini {model_name} failed: {e}')
                # Mark model as failed for future iterations
                failed_models.add(model_name)
                continue

    if generated_text is None:
        raise Exception('All AI providers failed')

    # Parse the response (AI is outputting Python-like syntax)
    try:
        import ast
        # Strip markdown code blocks if present
        import re
        # Remove ``` and ``` with optional language specifier
        generated_text = re.sub(r'^```(?:toml|python)?\s*', '', generated_text)
        generated_text = re.sub(r'```\s*$', '', generated_text)
        generated_text = generated_text.strip()

        if DEBUG_MODE:
            print(f"Attempting to parse response: {generated_text[:200]}...")
        # Parse as Python dict
        fixed_files = ast.literal_eval(generated_text)
        if not isinstance(fixed_files, dict):
            raise ValueError("Expected dict")
        # Convert to list in the order of files_to_fix
        component_codes = [fixed_files.get(file_path, "") for file_path in files_to_fix]
        if DEBUG_MODE:
            print(f"Successfully parsed {len(component_codes)} component codes")
    except Exception as e:
        print(f"Parsing failed: {e}")
        print(f"Raw response start: {generated_text[:500]}...")
        print(f"Raw response end: {generated_text[-500:]}...")
        # Fallback
        component_codes = [generated_text]

    return component_codes

def run_build():
    """Run build to check for compilation errors"""
    try:
        result = subprocess.run(['npx', 'ng', 'build', '--configuration', 'development'], capture_output=True, text=True, timeout=300)
        if result.returncode == 0:
            return True, None
        else:
            error_output = (result.stderr or '') + (result.stdout or '')
            return False, error_output[-3000:] if len(error_output) > 3000 else error_output
    except subprocess.TimeoutExpired:
        return False, "Build timed out after 5 minutes"
    except Exception as e:
        return False, f"Build execution error: {str(e)}"

def run_tests():
    stop_spinner = threading.Event()
    spinner_thread = threading.Thread(target=spinner, args=(stop_spinner, "Running tests"))
    spinner_thread.start()

    try:
        result = subprocess.run(['npx', 'ng', 'test', '--watch=false', '--browsers=ChromeHeadlessCI', '--code-coverage', '--reporters=progress,junit,kjhtml'], capture_output=True, text=True, timeout=300)
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

def run_build_and_tests():
    """Run build and then tests"""
    print('Running build...')
    build_success, build_error = run_build()
    if not build_success:
        print('Build failed:', build_error)
        return False, build_error

    print('Build passed. Running tests...')
    return run_tests()

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

def create_and_push_branch(modified_files):
    """Create sonar-fix branch and push changes"""
    try:
        # Stash any changes
        subprocess.run(['git', 'stash'], capture_output=True)
        # Switch to main branch
        subprocess.run(['git', 'checkout', 'main'], check=True, capture_output=True)
        # Delete branch if exists
        subprocess.run(['git', 'branch', '-D', BRANCH_NAME], capture_output=True)
        # Create new branch
        subprocess.run(['git', 'checkout', '-b', BRANCH_NAME], check=True)
        # Pop stash
        subprocess.run(['git', 'stash', 'pop'], capture_output=True)
        # Add only modified files
        for file_path in modified_files:
            subprocess.run(['git', 'add', file_path], check=True)
        # Commit
        subprocess.run(['git', 'commit', '-m', 'fix: AI-generated code smell fixes'], check=True)
        # Push (force if needed)
        subprocess.run(['git', 'push', '-f', '-u', 'origin', BRANCH_NAME], check=True)
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

    print('Running initial build and tests...')
    success, error = run_build_and_tests()
    if not success:
        print('Initial build/tests failed:', error)
        if CI_MODE:
            print('In CI mode, will attempt to fix initial errors')
            initial_error = error
        else:
            exit(1)
    else:
        print('Initial build and tests passed.')
        initial_error = ''

    max_iterations = 10
    iteration = 0
    modified_files = set()
    failed_models = set()  # Track failed models across iterations

    while iteration < max_iterations and grouped_issues:
        print(f'\nIteration {iteration + 1}: Fixing issues in {len(grouped_issues)} files')

        MAX_RETRIES = 7
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

                component_codes = generate_fixes_with_ai(issues_list, grouped_issues, files_to_fix, last_error, initial_error, failed_models)

                # Save AI response for review (debug mode)
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
                        modified_files.add(file_path)

                print('Running build and tests...')
                success, last_error = run_build_and_tests()
                if success:
                    print('Build and tests passed!')
                else:
                    print('Build/tests failed, retrying...')

            except Exception as e:
                error_str = str(e)
                # Check if it's a quota error - don't count as retry
                if '429' in error_str or 'quota' in error_str.lower():
                    print(f'Quota exceeded, trying different model without counting as retry...')
                    continue  # Don't increment retry counter
                else:
                    print('Error in fix generation/verification:', e)
                    last_error = error_str

            # Increment retry counter for build/test failures or non-quota AI errors
            if not success:
                current_retry += 1

        if not success:
            print('Failed to generate passing fixes after retries.')
            if not CI_MODE:
                exit(1)

        # After successful iteration, push and check progress with SonarCloud
        print('Pushing changes and checking progress with SonarCloud...')
        create_and_push_branch(list(modified_files))

        print('Waiting for CI to complete sonar scan...')
        time.sleep(300 if CI_MODE else 180)  # Wait longer in CI (5 min vs 3 min)

        print('Checking if issues are resolved...')
        api_response = fetch_code_smells(branch=BRANCH_NAME)
        issues = parse_issues(api_response)
        if not issues:
            print('All code smells resolved!')
            if not CI_MODE:
                # Only run coverage improvement in local mode
                print('Checking code coverage...')
                coverage = fetch_coverage(branch=BRANCH_NAME)
                if coverage is not None:
                    print(f'Current coverage: {coverage}%')
                    if coverage < 80:
                        print('Coverage below 80%, improving...')
                        try:
                            subprocess.run(['python', 'scripts/ai-coverage-fixer.py'], check=True)
                            print('Coverage improvement completed.')
                        except subprocess.CalledProcessError as e:
                            print(f'Coverage improvement failed: {e}')
                    else:
                        print('Coverage is good (>=80%).')
                else:
                    print('Could not fetch coverage, skipping improvement.')
            return  # Exit successfully

        # Re-group remaining issues
        grouped_issues = group_issues_by_file(issues)
        print(f'Still {len(grouped_issues)} files with issues after iteration {iteration + 1}')

        iteration += 1

    if grouped_issues:
        remaining_count = sum(len(issues) for issues in grouped_issues.values())
        print(f'Max iterations reached. Still {remaining_count} issues remaining in {len(grouped_issues)} files.')
    else:
        print('All code smells fixed.')

    print('Process completed.')

if __name__ == '__main__':
    check_code_smells_and_fix()