const fs = require('fs');
try {
    const env = fs.readFileSync('d:/DarMasr/GateManagment/.env', 'utf8');
    const match = env.match(/AUTH_SECRET_KEY=(.+)/);
    if (match) {
        console.log(match[1].trim());
    } else {
        console.error("Key not found");
    }
} catch (e) {
    console.error(e.message);
}
