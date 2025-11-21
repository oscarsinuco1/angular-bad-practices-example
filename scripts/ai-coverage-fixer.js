const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COVERAGE_SUMMARY_PATH = path.join(__dirname, '../coverage/coverage-summary.json');
const THRESHOLD = 80;

function checkCoverageAndFix() {
  if (!fs.existsSync(COVERAGE_SUMMARY_PATH)) {
    console.error('Coverage summary not found at:', COVERAGE_SUMMARY_PATH);
    process.exit(1);
  }

  const summary = JSON.parse(fs.readFileSync(COVERAGE_SUMMARY_PATH, 'utf8'));
  const totalCoverage = summary.total.lines.pct;

  console.log(`Total Line Coverage: ${totalCoverage}%`);

  if (totalCoverage >= THRESHOLD) {
    console.log('Coverage is sufficient. No AI fixes needed.');
    return;
  }

  console.log(`Coverage is below ${THRESHOLD}%. Initiating AI fix...`);

  // Find files with low coverage
  // For simplicity, we'll pick the file with the lowest coverage that isn't 0 (to avoid empty files)
  // or just iterate through files with < 80% coverage.
  // Let's just pick one to demonstrate the concept and avoid hitting rate limits or huge PRs.
  
  let worstFile = null;
  let lowestPct = 100;

  for (const [filePath, stats] of Object.entries(summary)) {
    if (filePath === 'total') continue;
    if (stats.lines.pct < THRESHOLD && stats.lines.pct > 0) { // Ignore 0% for now as they might be config files
       if (stats.lines.pct < lowestPct) {
         lowestPct = stats.lines.pct;
         worstFile = filePath;
       }
    }
  }

  if (!worstFile) {
    console.log('No specific file found with low coverage (or all are 0%).');
    // Fallback: try to find any file with 0 coverage if no partial coverage found
     for (const [filePath, stats] of Object.entries(summary)) {
        if (filePath === 'total') continue;
        if (stats.lines.pct < THRESHOLD) {
             worstFile = filePath;
             break;
        }
      }
  }
  
  if (!worstFile) {
      console.log("Could not identify a candidate file to fix.");
      return;
  }

  console.log(`Targeting file for improvement: ${worstFile} (${lowestPct}%)`);

  // Read the source file
  // The summary keys are usually absolute paths. We need to make sure we can read it.
  // If it's absolute, we can read it directly.
  
  let sourceCode = '';
  try {
      sourceCode = fs.readFileSync(worstFile, 'utf8');
  } catch (e) {
      console.error(`Failed to read file ${worstFile}:`, e);
      return;
  }

  // Construct the prompt
  const prompt = `
You are an expert Angular Unit Tester.
The following Angular file has low code coverage (${lowestPct}%).
Please generate a complete *.spec.ts file that tests this component/service to achieve high coverage.
Output the response in TOML format with a single key 'code' containing the Typescript code.
Example:
code = """
import { ... } from ...
...
"""

File Content:
${sourceCode}
`;

  console.log('Asking Gemini to generate tests (TOML format)...');
  
  try {
      const truncatedSource = sourceCode.length > 4000 ? sourceCode.substring(0, 4000) + '... (truncated)' : sourceCode;
      const safePrompt = prompt.replace(/"/g, '\\"'); 
      
      const command = `gemini-cli -p "${safePrompt}"`;
      
      const output = execSync(command, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 });
      
      // Parse TOML output (simple regex extraction for the 'code' key)
      // We look for code = """ ... """ or code = ''' ... '''
      let generatedCode = '';
      const tomlMatch = output.match(/code\s*=\s*(?:"""|''')([\s\S]*?)(?:"""|''')/);
      
      if (tomlMatch && tomlMatch[1]) {
          generatedCode = tomlMatch[1].trim();
      } else {
          // Fallback: try to find code block if TOML parsing fails or AI ignored instructions
          console.warn('Could not parse TOML. Falling back to markdown block extraction.');
          generatedCode = output.replace(/```typescript/g, '').replace(/```/g, '').trim();
      }
      
      if (!generatedCode) {
          console.error('Failed to extract code from AI output.');
          return;
      }

      const specFile = worstFile.replace('.ts', '.spec.ts');
      
      console.log(`Writing generated tests to ${specFile}...`);
      fs.writeFileSync(specFile, generatedCode);
      
      console.log('Test generation complete.');
      
  } catch (e) {
      console.error('Error generating tests with Gemini:', e);
      process.exit(1);
  }
}

checkCoverageAndFix();
