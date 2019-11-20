process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT']
process.env['MAGICK_CONFIGURE_PATH'] = process.env['LAMBDA_TASK_ROOT']

const environment = process.env['AWS_EXECUTION_ENV'] || "development"
const isLambda = environment.indexOf("AWS") === 0

console.log("Environment: " + environment)

const child = require('child_process')
const AWS = require('aws-sdk')
const s3 = new AWS.S3()
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

if (environment == 'development'){
  const minimist = require('minimist')
  const argv = minimist(process.argv.slice(2))
  const inputPath = argv._[0]

  var extension = checkExtension(inputPath)

  convert(inputPath, 'test/', function(error){
    console.log('All done')
  })
}

function handler (event, context) {
  // get s3 bucket and key (path) from the trigger

  var sourceBucket = event.Records[0].s3.bucket.name
  // Object key may have spaces or unicode non-ASCII characters.
  var sourceKey = event.Records[0].s3.object.key.replace(/\+/g, ' ')
  sourceKey = decodeURIComponent(sourceKey)

  console.log(sourceBucket)
  console.log(sourceKey)

  var extension = checkExtension(sourceKey)

  download(sourceBucket, sourceKey, function(){
    convert('/tmp/input.' + extension, '/tmp/', function(error, outputExtension){
      var filepath = (error) ? 'file-icon.png' : '/tmp/output.' + outputExtension
      var destinationKey = getDestinationKey(sourceKey, outputExtension)
      upload(filepath, sourceBucket, destinationKey)
    })
  })
}

function checkExtension (filepath){
  var extension = path.extname(filepath).replace('.','')

  var validExtensions = ['svg']

  if (validExtensions.includes(extension) === false) {
    throw "Can't process this filetype: " + filepath
  }

  return extension
}

function download (sourceBucket, sourceKey, callback) {
  console.time('download')
  console.log('download')

  var extension = path.extname(sourceKey).replace('.','')

  // Download the file from S3 into a buffer.
  var file = fs.createWriteStream('/tmp/input.' + extension)

  file.on('close', callback)

  s3.getObject({
    Bucket: sourceBucket,
    Key: sourceKey
  }).createReadStream().on('error', function (err) {
    console.log(err)
  }).pipe(file)

  console.timeEnd('download')
}

function convert (inputPath, outputDir, callback) {
  console.time('convert')
  console.log('convert')

  if (!inputPath){
    console.error("Error: no inputPath given")
    process.exit(1)
  }

  (async () => {

    const executablePath = (isLambda) ? __dirname + '/headless-chromium' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    console.log('executablePath: ' + executablePath)
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: executablePath
    })
    const inputHTML = 'file://' + __dirname + '/input.html'
    const page = await browser.newPage()
    await page.goto(inputHTML)
    const dimensions = await page.$eval('img', function(el){
      const dimensions = el.getBoundingClientRect()
      return {
        width: dimensions.width,
        height: dimensions.height
      }
    })
    if (dimensions.width > dimensions.height){
      await page.$eval('img', el => el.setAttribute('width', 1024))
    } else {
      await page.$eval('img', el => el.setAttribute('height', 1024))
    }
    const img = await page.$('img')
    await img.screenshot({path: outputDir + 'output.png'})
    await browser.close()
    console.log('convert done')
    callback(false, 'png')

  })();

}

function getDestinationKey(sourceKey, newExtension){
  var newKey = sourceKey.split('/')
  newKey.shift() // remove 'pdf/'
  newKey.unshift('out')
  newKey = newKey.join('/') + '.thumbnail.' + newExtension
  console.log(`newKey: ${newKey}`)
  return newKey
}

function upload (filepath, destinationBucket, destinationKey) {

  console.time('upload')
  console.log('upload')

  var fileStream = fs.createReadStream(filepath)
  fileStream.on('error', function (err) {
    if (err) { throw err }
  })
  fileStream.on('open', function () {
    s3.putObject({
      Bucket: destinationBucket,
      Key: destinationKey,
      Body: fileStream,
      ContentType: path.extname(filepath).replace('.','')
    }, function (err) {
      console.timeEnd('upload')
      if (err) {
        console.error(err)
      } else {
        console.log('done')
      }
    })
  })
}

exports.handler = handler

// to do - add download and upload functions from aws-lambda-convert
// make it work locally and remotely, like aws-lamba-convert
// split out all 3? ghostscript pdf, imagemagick bitmaps, chrome SVG
// convert png to jpeg - might be safer?

// const { convertFile}  = require('convert-svg-to-png');
//
// (async() => {
//   const inputFilePath = 'AU-flag.svg';
//   let options = {
//     outputFilePath: 'output.png',
//     height: 1024,
//     width: 1024,
//     puppeteer: {
//       executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
//     }
//   }
//   const outputFilePath = await convertFile(inputFilePath, options);
//
//   console.log(outputFilePath);
//   //=> "/path/to/my-image.png"
// })();
