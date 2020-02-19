const path = require('path')

module.exports = {
  mode: 'development',
  entry: './src/main.js',
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'showcase.js'
  },
  devServer: {
    contentBase: path.join(__dirname),
    host: '0.0.0.0',
    port: 9000,
    hot: true,
    watchContentBase: true
  }
}
