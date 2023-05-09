// const webpack = require("webpack");
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

/*
 * This plugin returns the css associated with entrypoints. Those chunks can be found
 * in `htmlWebpackPlugin.files.cssChunks`.
 * The HTML Webpack plugin removed the chunks object in v5 in favour of an array however if we want
 * to do anything smart with hashing (e.g. [contenthash]) we need a map of { themeName: chunkNameWithHash }.
 */
class HTMLWebpackCSSChunks {
  /**
   * @param {import('webpack').Compiler} compiler
   */
  apply(compiler) {
    compiler.hooks.compilation.tap(
      'HTMLWebpackCSSChunks',
      /**
       * @param {import('webpack').Compilation} compilation
       */
      (compilation) => {
        HtmlWebpackPlugin.getHooks(compilation).beforeAssetTagGeneration.tapAsync(
          'HTMLWebpackCSSChunks',
          (data, cb) => {
            data.assets.cssChunks = {};

            for (const entryPoint of compilation.entrypoints.values()) {
              for (const chunk of entryPoint.chunks) {
                const cssFile = [...chunk.files].find((file) => file.endsWith('.css'));
                if (cssFile !== undefined) {
                  data.assets.cssChunks[chunk.name] = cssFile;
                }
              }
            }

            cb(null, data);
          }
        );
      }
    );
  }
}


module.exports = {
  mode: 'development',
  devtool: 'source-map',
  devServer: {
    devMiddleware: {
      index: true,
      mimeTypes: { phtml: 'text/html' },
      publicPath: '/',
      serverSideRender: false,
      writeToDisk: true,
    },
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    liveReload: true,
    compress: true,
    port: 9000,
  },
  target: 'web',
  entry: {
    app: './src/index.ts',
    dark: './src/css/fermions.dark.css',
    light: './src/css/fermions.light.css',
  },
  output: {
    clean: true,
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    publicPath: './',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    modules: ['node_modules', path.resolve('src')],
    fallback: {
      buffer: false,
      fs: false,
      stream: false,
      http: false,
      https: false,
      string_decoder: false,
    },
    symlinks: false,
  },
  stats: {
    children: false,
    source: false,
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'fermions.[name].css',
    }),
    new HtmlWebpackPlugin({
      // filename: path.resolve(__dirname, '../../public/views/index.html'),
      template: path.resolve(__dirname, 'src/index.html'),
      inject: false,
      excludeChunks: ['dark', 'light'],
      chunksSortMode: 'none',
    }),
    new HTMLWebpackCSSChunks(),
    // new webpack.ProvidePlugin({
    //   process: 'process/browser'
    // }),
    new CopyPlugin({
      patterns: [
        { from: "assets/wasm_exec.js", to: "wasm_exec.js" },
        { from: "assets/fermions-workflow-standalone.wasm", to: "fermions-workflow-standalone.wasm" },
      ],
    }),
    function () {
      this.hooks.done.tap('Done', function (stats) {
        if (stats.compilation.errors && stats.compilation.errors.length) {
          console.log(stats.compilation.errors);
          process.exit(1);
        }
      });
    },
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              importLoaders: 2,
              // url: options.preserveUrl,
              // sourceMap: options.sourceMap,
            },
          },
        ],
      },
      {
        test: /\.(svg|ico|jpg|jpeg|png|gif|eot|otf|webp|ttf|woff|woff2|cur|ani|pdf)(\?.*)?$/,
        type: 'asset/resource',
        generator: { filename: 'static/img/[name].[hash:8][ext]' },
      },
    ],
  },


  // https://webpack.js.org/plugins/split-chunks-plugin/#split-chunks-example-3
  optimization: {
    runtimeChunk: 'single',
    // splitChunks: {
    //   chunks: 'all',
    //   minChunks: 1,
    //   cacheGroups: {
    //     defaultVendors: {
    //       test: /[\\/]node_modules[\\/].*[jt]sx?$/,
    //       chunks: 'initial',
    //       priority: -10,
    //       reuseExistingChunk: true,
    //       enforce: true,
    //     },
    //     default: {
    //       priority: -20,
    //       chunks: 'all',
    //       test: /.*[jt]sx?$/,
    //       reuseExistingChunk: true,
    //     },
    //   },
    // },
  },
};