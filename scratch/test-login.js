async function run() {
  try {
    // 1. Fetch CSRF token and cookies
    console.log('Fetching CSRF token...');
    const csrfRes = await fetch('http://localhost:3000/api/auth/csrf');
    const csrfCookiesHeader = csrfRes.headers.get('set-cookie');
    console.log('CSRF Set-Cookie header:', csrfCookiesHeader);
    const csrfData = await csrfRes.json();
    console.log('CSRF data:', csrfData);
    const csrfToken = csrfData.csrfToken;

    // 2. Fetch Captcha
    console.log('Fetching captcha...');
    const captchaRes = await fetch('http://localhost:3000/api/captcha');
    const captchaCookiesHeader = captchaRes.headers.get('set-cookie');
    console.log('Captcha Set-Cookie header:', captchaCookiesHeader);
    const captchaData = await captchaRes.json();
    const { a, b } = captchaData;
    const answer = (a + b).toString();
    console.log(`Captcha numbers: ${a} + ${b} = ${answer}`);

    // Parse cookies
    const cookiesList = [];
    if (csrfCookiesHeader) {
      cookiesList.push(csrfCookiesHeader.split(';')[0]);
    }
    if (captchaCookiesHeader) {
      cookiesList.push(captchaCookiesHeader.split(';')[0]);
    }
    const mergedCookie = cookiesList.join('; ');
    console.log('Sending Cookie header:', mergedCookie);

    // 3. Perform Sign In
    const body = new URLSearchParams({
      email: 'mohommadammar826@gmail.com',
      password: 'admin123',
      captchaAnswer: answer,
      callbackUrl: 'http://localhost:3000/dashboard',
      redirect: 'false',
      csrfToken: csrfToken,
      json: 'true'
    });

    console.log('Sending authorize request...');
    const authRes = await fetch('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': mergedCookie
      },
      body: body.toString()
    });

    console.log('Response Status:', authRes.status);
    const authText = await authRes.text();
    console.log('Response Body:', authText);

  } catch (e) {
    console.error('Error during test:', e);
  }
}

run();
