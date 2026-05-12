const http = require('http');

const urls = [
  'http://localhost:5173',
  'http://localhost:3001',
  'http://localhost:3000'
];

console.log('Checking KPIBoard servers...\n');

let completed = 0;
const results = {};

urls.forEach(url => {
  const req = http.get(url, (res) => {
    results[url] = { status: 'RUNNING', code: res.statusCode };
    console.log(`✓ ${url} - Status: ${res.statusCode}`);
    req.destroy();
    completed++;
    if (completed === urls.length) printSummary();
  });

  req.on('error', (e) => {
    results[url] = { status: 'ERROR', message: e.message };
    console.log(`✗ ${url} - Error: ${e.message}`);
    completed++;
    if (completed === urls.length) printSummary();
  });

  req.setTimeout(2000, () => {
    if (!results[url]) {
      results[url] = { status: 'TIMEOUT', message: 'No response after 2 seconds' };
      console.log(`⏱ ${url} - Timeout (no response after 2s)`);
      req.destroy();
      completed++;
      if (completed === urls.length) printSummary();
    }
  });
});

function printSummary() {
  console.log('\n--- Summary ---');
  Object.entries(results).forEach(([url, result]) => {
    if (result.status === 'RUNNING') {
      console.log(`${url}: RUNNING (HTTP ${result.code})`);
    } else {
      console.log(`${url}: ${result.status} (${result.message})`);
    }
  });
}
