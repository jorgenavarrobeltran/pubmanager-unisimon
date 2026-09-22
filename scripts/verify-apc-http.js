const http = require('http');

http.get('http://localhost:3000/apc', (res) => {
  console.log('Status code:', res.statusCode);
  console.log('Location header:', res.headers.location);
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log('Body length:', data.length);
  });
}).on('error', (err) => {
  console.error('Error fetching page:', err.message);
});
