const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// Step 1: Build frontend using Vite (handles Tailwind CSS + PostCSS properly)
console.log('=== Building frontend with vite build ===');
try {
  execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });
  console.log('Frontend built!');
} catch (e) {
  console.error('Frontend build failed:', e.message);
  process.exit(1);
}

// Step 2: Copy dist to Android assets
console.log('\n=== Copying to Android assets ===');
const distDir = path.join(ROOT, 'dist');
const assetsDir = path.join(ROOT, 'android/app/src/main/assets/www');

fs.rmSync(assetsDir, { recursive: true, force: true });
fs.mkdirSync(assetsDir, { recursive: true });

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

copyDir(distDir, assetsDir);
console.log('Assets copied!');

// Step 3: Build APK
console.log('\n=== Building APK ===');
try {
  execSync('/root/.gradle/wrapper/dists/gradle-9.4.1-bin/arn2x92ynaizyzdaamcbpbhtj/gradle-9.4.1/bin/gradle assembleDebug --no-daemon', {
    cwd: path.join(ROOT, 'android'),
    stdio: 'inherit'
  });
  console.log('APK build success!');
} catch (e) {
  console.error('APK build failed:', e.message);
  process.exit(1);
}

// Step 4: Copy APK to project root
const apkSrc = path.join(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk');
const apkDest = path.join(ROOT, 'WebChat4.apk');
if (fs.existsSync(apkSrc)) {
  fs.copyFileSync(apkSrc, apkDest);
  const size = (fs.statSync(apkDest).size / 1024 / 1024).toFixed(1);
  console.log('\n✅ APK ready: WebChat4.apk (' + size + 'MB)');
} else {
  console.error('APK not found!');
}
