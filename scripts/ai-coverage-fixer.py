import os
import json
import subprocess
import re
import time
import sys
import threading
import itertools
import google.generativeai as genai

COVERAGE_SUMMARY_PATH = os.path.join(os.path.dirname(__file__), '../coverage/coverage-summary.json')
THRESHOLD = 80

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

def get_coverage():
    if not os.path.exists(COVERAGE_SUMMARY_PATH):
        print('Coverage summary not found at:', COVERAGE_SUMMARY_PATH)
        exit(1)
    with open(COVERAGE_SUMMARY_PATH, 'r') as f:
        summary = json.load(f)
    return summary['total']['lines']['pct'], summary

def find_low_coverage_files(summary):
    low_coverage_files = []
    for file_path, stats in summary.items():
        if file_path == 'total':
            continue
        if stats['lines']['pct'] < THRESHOLD:
            low_coverage_files.append((file_path, stats['lines']['pct']))
    low_coverage_files.sort(key=lambda x: x[1])
    return low_coverage_files[:3]  # Top 3

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

def generate_tests_with_ai(file_contents, last_error):
    # Get complete repo structure and content for each iteration
    tree_structure, repo_content = get_repo_structure_and_content()

    full_prompt = """
You are an expert Angular 20 Unit Tester.
The following Angular 20 application has low code coverage on specific files.
Please generate complete *.spec.ts files that test these components/services to achieve high coverage.
Use Jasmine and Angular Testing Utilities (TestBed, ComponentFixture, etc.).
Ensure tests cover branches, statements, and functions.

Angular 20 Testing Guidelines:
- Signals: input<T>() are read-only; model<T>() are mutable with .set().
- Modify input<T>() to model<T>() for testability only if needed; keep existing model<T>() unchanged.
- Use model.required<T>() for required values to ensure they are set and non-null.
- model<T>() can be undefined; model.required<T>() throws if not set.
- Testing signals: Use component.signal.set(value) only for model signals; never for input signals.
- Do not use 'as any', type assertions, or bracket notation like component['property'] to bypass TypeScript; always modify the component to use testable patterns.
- Services: Mock with TestBed providers or spyOn.
- Observables: Mock with RxJS operators like of(value), throwError(), NEVER, etc.
- Outputs: Spy on component.output.emit.
- ComponentFixture: Use fixture.detectChanges() after changes.
- Async: Use fakeAsync/tick or waitForAsync for async operations.
- HttpClient: Mock with provideHttpClient() and provideHttpClientTesting() in TestBed providers.
- Animations: Use provideNoopAnimations() instead of NoopAnimationsModule.

Angular Template Guidelines (for "cannot bind" errors):
- Use CUSTOM_ELEMENTS_SCHEMA in test modules for custom elements
- Add schemas: [CUSTOM_ELEMENTS_SCHEMA] to TestBed.configureTestingModule
- For Angular Material components, ensure proper imports in test module
- For custom components, use NO_ERRORS_SCHEMA or CUSTOM_ELEMENTS_SCHEMA

Project Config:
- TypeScript: strict mode enabled, target ES2022.
- Angular: strict templates, injection parameters, etc.

Always modify input signals to model signals in the component code for testability. Provide the complete modified component code. Do not attempt workarounds in tests.

Example: Use this.example()?.test instead of this.example().test for null safety.

Output the response only in JSON format with keys:
- 'spec_codes': array of complete Typescript codes for the *.spec.ts files, in the SAME ORDER as the files listed above (spec_codes[0] for File 1, spec_codes[1] for File 2, etc.)
- 'component_codes': (optional) array of modified Typescript codes for the original components if changes are needed, in the same order

Example:
{{"spec_codes": ["import {{ ... }} from ...\\n...", "..."], "component_codes": ["import {{ ... }} from ...\\n...", "..."]}}

REMENBER: response only contains json format, not text, not recommendations, only json format

COMPLETE APPLICATION CONTEXT:
"""

    # Add tree structure
    full_prompt += "\n\n=== PROJECT STRUCTURE ===\n" + tree_structure

    # Add all file contents
    full_prompt += "\n\n=== ALL FILES CONTENT ===\n"
    for file_path, content in repo_content.items():
        full_prompt += f"\n--- {file_path} ---\n{content}\n"

    # Add specific files that need testing
    full_prompt += "\n\n=== FILES NEEDING TESTS (LOW COVERAGE) ===\n"
    for i, (file_path, pct) in enumerate(file_contents):
        full_prompt += f"\n\nFile {i+1}: {file_path} (Coverage: {pct}%)"


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

    # Parse the JSON response
    try:
        # Strip markdown code blocks if present (more robust)
        import re
        # Remove ```json and ``` with optional language specifier
        generated_text = re.sub(r'^```(?:json)?\s*', '', generated_text)
        generated_text = re.sub(r'```\s*$', '', generated_text)
        generated_text = generated_text.strip()

        print(f"Attempting to parse JSON: {generated_text[:200]}...")
        parsed = json.loads(generated_text)
        spec_codes = parsed.get('spec_codes', [])
        component_codes = parsed.get('component_codes', [])
        print(f"Successfully parsed {len(spec_codes)} spec codes and {len(component_codes)} component codes")
    except json.JSONDecodeError as e:
        print(f"JSON parsing failed: {e}")
        print(f"Raw response start: {generated_text[:500]}...")
        print(f"Raw response end: {generated_text[-500:]}...")
        # Fallback if not JSON
        spec_codes = [generated_text]
        component_codes = []

    return spec_codes, component_codes

def run_tests():
    stop_spinner = threading.Event()
    spinner_thread = threading.Thread(target=spinner, args=(stop_spinner, "Running tests"))
    spinner_thread.start()

    try:
        result = subprocess.run(['npm', 'run', 'test:ci'], capture_output=True, text=True, timeout=300)
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

def check_coverage_and_fix():
    print('Running initial tests to generate fresh coverage data...')
    success, error = run_tests()
    if not success:
        print('Initial tests failed:', error)
        exit(1)
    print('Initial tests passed. Coverage data updated.')

    max_iterations = 15
    iteration = 0

    while iteration < max_iterations:
        total_coverage, summary = get_coverage()
        print()
        print_progress_bar(total_coverage, THRESHOLD, f'Iteration {iteration + 1}: Analyzing coverage')

        if total_coverage >= THRESHOLD:
            print_progress_bar(THRESHOLD, THRESHOLD, 'Coverage goal achieved!')
            return

        print(f'Coverage is below {THRESHOLD}%. Initiating AI fix...')

        files_to_fix = find_low_coverage_files(summary)
        if not files_to_fix:
            print("No files with low coverage found.")
            return

        file_names = [os.path.basename(f[0]) for f in files_to_fix]
        print()
        print_progress_bar(total_coverage, THRESHOLD, f'Improving: {", ".join(file_names)}')

        file_contents = files_to_fix  # Just the list of (file_path, pct) tuples

        MAX_RETRIES = 7
        current_retry = 0
        last_error = ''
        success = False

        while current_retry < MAX_RETRIES and not success:
            print(f' - Attempt {current_retry + 1}/{MAX_RETRIES}...')

            print_progress_bar(total_coverage, THRESHOLD, f'Generating AI tests (attempt {current_retry + 1})')
            print()

            try:
                spec_codes, component_codes = generate_tests_with_ai(file_contents, last_error)

                if DEBUG_MODE:
                    # Save AI response for review instead of applying
                    response_data = {
                        'spec_codes': spec_codes,
                        'component_codes': component_codes,
                        'file_paths': [fp for fp, _ in file_contents]
                    }
                    response_filename = f'ai_response_{int(time.time())}.json'
                    with open(response_filename, 'w') as f:
                        json.dump(response_data, f, indent=2)
                    print(f'DEBUG MODE: AI response saved to {response_filename} for review')
                    print('Please review the response and apply manually, or set DEBUG_MODE = False to auto-apply')
                    return  # Don't proceed with applying changes
                else:
                    response_data = {
                        'spec_codes': spec_codes,
                        'component_codes': component_codes,
                        'file_paths': [fp for fp, _ in file_contents]
                    }
                    response_filename = f'ai_response_{int(time.time())}.json'
                    with open(response_filename, 'w') as f:
                        json.dump(response_data, f, indent=2)
                    print(f"About to write {len(spec_codes)} spec files and {len(component_codes)} component files")
                    for i, (file_path, _) in enumerate(file_contents):
                        if i < len(spec_codes):
                            spec_file = file_path.replace('.ts', '.spec.ts')
                            print(f'Writing generated tests to {spec_file}... (length: {len(spec_codes[i])})')
                            with open(spec_file, 'w') as f:
                                f.write(spec_codes[i])

                        if i < len(component_codes) and component_codes[i]:
                            print(f'Applying changes to component {file_path}... (length: {len(component_codes[i])})')
                            with open(file_path, 'w') as f:
                                f.write(component_codes[i])
                        else:
                            print(f'No component changes for {file_path}')

                print_progress_bar(total_coverage, THRESHOLD, 'Running tests...')
                print()
                success, last_error = run_tests()
                if success:
                    print_progress_bar(total_coverage, THRESHOLD, 'Tests passed! Updating coverage...')
                    print()
                else:
                    print_progress_bar(total_coverage, THRESHOLD, 'Tests failed, retrying...')
                    print()

            except Exception as e:
                print('Error in generation/verification step:', e)
                last_error = str(e)

            current_retry += 1

        if not success:
            print('Failed to generate passing tests after retries. Keeping the last attempt.')
            exit(1)

        iteration += 1

    print_progress_bar(total_coverage, THRESHOLD, 'Process completed')

if __name__ == '__main__':
    check_coverage_and_fix()