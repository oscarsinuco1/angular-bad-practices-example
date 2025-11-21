// Karma configuration file, see link for more information
// https://karma-runner.github.io/latest/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      // Add the JUnit reporter plugin
      require('karma-junit-reporter')
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // clearLookups: true,
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcov' }
      ]
    },
    // Add JUnit reporter configuration
    junitReporter: {
      outputDir: require('path').join(__dirname, './junit-report'), // results will be saved as outputDir/browserName.xml
      outputFile: 'junit.xml', // if included, results will be saved as outputDir/browserName/outputFile
      suite: '', // suite will become the package name attribute in xml testsuite element
      useBrowserName: false, // add browser name to report and classes names
      properties: {}, // pass properties to the report
      xmlVersion: null // use standard xml version/declaration
    },
    reporters: ['progress', 'kjhtml', 'junit'], // Add 'junit' to the reporters array
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox']
      }
    },
    singleRun: false,
    restartOnFileChange: true
  });
};
