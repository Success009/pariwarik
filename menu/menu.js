// Loader to preserve backward compatibility for anyone calling menu.js directly
(function() {
    const scripts = [
        'js/menu-core.js',
        'js/cart.js',
        'js/order-flow.js'
    ];
    // Find path of current script (to preserve relative paths)
    const scriptsEls = document.getElementsByTagName('script');
    const thisScriptEl = scriptsEls[scriptsEls.length - 1];
    const src = thisScriptEl ? thisScriptEl.src : '';
    const basePath = src.substring(0, src.lastIndexOf('/') + 1);

    scripts.forEach(s => {
        const el = document.createElement('script');
        el.src = basePath + s;
        el.async = false; // ensure chronological load order
        document.head.appendChild(el);
    });
})();