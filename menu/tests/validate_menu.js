const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== STARTING MENU APPLICATION INTEGRITY TESTS ===\n');

const menuDir = path.resolve(__dirname, '..');
const jsDir = path.join(menuDir, 'js');
const cssDir = path.join(menuDir, 'css');

let pass = true;

// Helper to check syntax of a JS file using node CLI
function checkJSSyntax(filePath) {
    try {
        // node -c checks syntax without executing
        execSync(`node -c "${filePath}"`);
        console.log(`✓ Syntax check passed: ${path.basename(filePath)}`);
        return true;
    } catch (e) {
        console.error(`✗ Syntax error in ${path.basename(filePath)}:`, e.message);
        return false;
    }
}

// 1. Verify file existence
const requiredFiles = [
    path.join(menuDir, 'index.html'),
    path.join(menuDir, 'menu.css'),
    path.join(menuDir, 'menu.js'),
    path.join(jsDir, 'menu-core.js'),
    path.join(jsDir, 'cart.js'),
    path.join(jsDir, 'order-flow.js'),
    path.join(cssDir, 'menu-core.css'),
    path.join(cssDir, 'cart.css'),
    path.join(cssDir, 'order-flow.css')
];

console.log('Checking file structural integrity...');
requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✓ File exists: ${path.relative(menuDir, file)}`);
    } else {
        console.error(`✗ Missing file: ${path.relative(menuDir, file)}`);
        pass = false;
    }
});

console.log('\nChecking Javascript syntax...');
const jsFiles = [
    path.join(menuDir, 'menu.js'),
    path.join(jsDir, 'menu-core.js'),
    path.join(jsDir, 'cart.js'),
    path.join(jsDir, 'order-flow.js')
];
jsFiles.forEach(file => {
    if (fs.existsSync(file)) {
        if (!checkJSSyntax(file)) pass = false;
    }
});

// 2. Validate index.html content
console.log('\nValidating index.html references & layout...');
const htmlContent = fs.readFileSync(path.join(menuDir, 'index.html'), 'utf8');

const expectedScripts = [
    'js/menu-core.js',
    'js/cart.js',
    'js/order-flow.js'
];
expectedScripts.forEach(script => {
    if (htmlContent.includes(script)) {
        console.log(`✓ Script reference found: ${script}`);
    } else {
        console.error(`✗ Missing script reference: ${script}`);
        pass = false;
    }
});

const expectedStylesheets = [
    'css/menu-core.css',
    'css/cart.css',
    'css/order-flow.css'
];
expectedStylesheets.forEach(css => {
    if (htmlContent.includes(css)) {
        console.log(`✓ CSS reference found: ${css}`);
    } else {
        console.error(`✗ Missing CSS reference: ${css}`);
        pass = false;
    }
});

// 3. Verify the new area selection elements
console.log('\nChecking the new area selection UI markup...');
if (htmlContent.includes('selectArea(\'Chaubiskothi Area\')') && htmlContent.includes('selectArea(\'CMC Area\')')) {
    console.log('✓ Buttons for Chaubiskothi Area and CMC Area exist and call selectArea()');
} else {
    console.error('✗ Missing selectArea() click events or buttons in index.html');
    pass = false;
}

if (htmlContent.includes('selectSomewhereElse()')) {
    console.log('✓ Somewhere Else button exists and calls selectSomewhereElse()');
} else {
    console.error('✗ Missing selectSomewhereElse() click event in index.html');
    pass = false;
}

// 4. Verify JS implementations for new functions
console.log('\nChecking function definitions in scripts...');
const orderFlowContent = fs.readFileSync(path.join(jsDir, 'order-flow.js'), 'utf8');

if (orderFlowContent.includes('function selectArea')) {
    console.log('✓ function selectArea is defined in order-flow.js');
} else {
    console.error('✗ selectArea is NOT defined in order-flow.js');
    pass = false;
}

if (orderFlowContent.includes('function selectSomewhereElse')) {
    console.log('✓ function selectSomewhereElse is defined in order-flow.js');
} else {
    console.error('✗ selectSomewhereElse is NOT defined in order-flow.js');
    pass = false;
}

if (orderFlowContent.includes('localStorage.setItem(\'pariwarik_cart\'')) {
    console.log('✓ localStorage.setItem(\'pariwarik_cart\') call found in order-flow.js');
} else {
    console.error('✗ localStorage.setItem(\'pariwarik_cart\') is NOT found in order-flow.js');
    pass = false;
}

console.log('\n==================================================');
if (pass) {
    console.log('🎉 ALL INTEGRITY TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
} else {
    console.error('🚨 INTEGRITY TESTS FAILED! PLEASE CHECK ERRORS. 🚨');
    process.exit(1);
}
