const path = require('path')
const webpack = require('webpack')
const ESDynamicImportPlugin = require('@extscreen/es3-dynamic-import-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const { VueLoaderPlugin } = require('vue-loader')
const watchPlugin = require('./webpack-watch.ts')

const pkg = require('../package.json')
let cssLoader = '@hippy/vue-css-loader'

module.exports = {
  mode: 'development',
  devtool: 'eval-source-map',
  watch: true,
  watchOptions: {
    aggregateTimeout: 1500,
    poll: 1000,
    ignored: /node_modules/,
  },
  devServer: {
    remote: {
      protocol: 'http',
      host: '127.0.0.1',
      port: 38989
    },
    vueDevtools: false,
    multiple: false,
    hot: false,
    liveReload: false,
    client: {
      overlay: false
    },
    devMiddleware: {
      writeToDisk: true
    }
  },
  entry: {
    index: ['@hippy/rejection-tracking-polyfill', path.resolve(pkg.main)]
  },
  output: {
    filename: 'index.bundle',
    strictModuleExceptionHandling: true,
    path: path.resolve('./dist/dev/'),
    globalObject: '(0, eval)("this")',
    assetModuleFilename: '[hash][ext][query]'
  },
  plugins: [
    new VueLoaderPlugin(),
    new watchPlugin(),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('development'),
        HOST: JSON.stringify(process.env.DEV_HOST || '127.0.0.1'),
        PORT: JSON.stringify(process.env.DEV_PORT || 38989)
      },
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      __PLATFORM__: null,
      __DEV__: true
    }),
    new ESDynamicImportPlugin(),
    new CleanWebpackPlugin()
  ],
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: [
          {
            loader: 'vue-loader',
            options: {
              compilerOptions: {
                hoistStatic: false,
                whitespace: 'condense'
              }
            }
          }
        ]
      },
      {
        test: /\.(sc|c)ss$/,
        use: [
          cssLoader,
          {
            loader: 'sass-loader',
          }
        ]
      },
      {
        test: /\.t|js$/,
        use: [
          {
            loader: 'esbuild-loader',
            options: {
              target: 'es2015'
            }
          }
        ]
      },
      {
        test: /\.(png|jpe?g|gif)$/i,
        type: 'asset/resource',
        generator: {
          outputPath: 'assets/',
          publicPath: 'assets/'
        }
      },
      {
        test: /\.(ts)$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              appendTsSuffixTo: [/\.vue$/]
            }
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto'
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.vue', '.json', '.ts'],
    alias: (() => {
      const aliases = {
        src: path.resolve('./src'),
        quicktvui: path.resolve('../dist/quicktvui')
      }
      return aliases
    })()
  }
}
