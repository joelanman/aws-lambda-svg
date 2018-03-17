const puppeteer = require('puppeteer')

const main = (async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    // headless: false
  })
  const page = await browser.newPage()
  page.on('console', msg => {
  for (let i = 0; i < msg.args.length; ++i)
    console.log(`${i}: ${msg.args[i]}`);
  });
  await page.goto('file:///Users/joelanman/projects/aws-lambda-svg/input.html')
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
  await img.screenshot({path: 'output.png'})
  await browser.close()
})

main()

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
