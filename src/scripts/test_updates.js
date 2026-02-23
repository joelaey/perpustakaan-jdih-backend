const http = require('http');

const baseURL = 'http://localhost:5001/api';

const makeRequest = (method, path, data = null, token = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5001,
            path: `/api${path}`,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
};

async function testFlow() {
    console.log("1. Testing Registration (Humanized Errors)");
    // Trying without name
    let res = await makeRequest('POST', '/auth/register', { email: 'test@test.com', password: '123' });
    console.log("Error test (missing name):", res.data);

    const testEmail = `user${Date.now()}@example.com`;
    const testPhone = '81234567890';

    console.log(`\n2. Creating user ${testEmail} with phone ${testPhone}`);
    res = await makeRequest('POST', '/auth/register', {
        name: 'Test Setup User',
        email: testEmail,
        password: 'password123',
        phone_number: testPhone
    });
    console.log("Register response:", res.data);

    const token = res.data?.data?.token;
    if (!token) {
        console.error("Failed to get token!");
        return;
    }

    console.log("\n3. Testing Login (Humanized Errors)");
    res = await makeRequest('POST', '/auth/login', { email: testEmail, password: 'wrongpassword' });
    console.log("Error test (wrong password):", res.data);

    console.log("\n4. Getting Profile (Checking phone number)");
    res = await makeRequest('GET', '/auth/me', null, token);
    console.log("Profile data:", res.data.data);

    console.log("\n5. Updating Profile (Changing phone number)");
    res = await makeRequest('PUT', '/users/profile', {
        name: 'Test Setup User Updated',
        phone_number: '8999999999'
    }, token);
    console.log("Update profile response:", res.data.data);
}

testFlow().catch(console.error);
