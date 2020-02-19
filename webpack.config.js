const path = require('path')

module.exports = {
  mode: 'production',
  entry: './src/main.js',
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'synthesis.js',
    library: 'synthesisjs',
    libraryTarget: 'umd'
  }
}
