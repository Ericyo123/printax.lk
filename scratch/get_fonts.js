const fs = require('fs');
const https = require('https');

const fontUrl = 'https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Regular.ttf';
const fontBoldUrl = 'https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf';

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      res.on('error', reject);
    });
  });
}

async function run() {
  try {
    const reg = await download(fontUrl);
    const bold = await download(fontBoldUrl);
    fs.writeFileSync('poppins_base64.json', JSON.stringify({ reg, bold }));
    console.log('Done');
  } catch (e) {
    console.error(e);
  }
}

run();
