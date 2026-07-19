export function getThemeRgb(variableName) {
    const tempDiv = document.createElement('div');
    tempDiv.style.color = `var(${variableName})`;
    document.body.appendChild(tempDiv);
    const computedColor = window.getComputedStyle(tempDiv).color;
    document.body.removeChild(tempDiv);
    
    const match = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
        return `${match[1]}, ${match[2]}, ${match[3]}`;
    }
    return null;
}

export function injectThemeRgbVariables() {
    const variables = [
        '--SmartThemeBlurTintColor',
        '--SmartThemeChatTintColor',
        '--SmartThemeUserMesBlurTintColor',
        '--SmartThemeBotMesBlurTintColor',
        '--SmartThemeEmColor',
        '--SmartThemeUnderlineColor',
        '--SmartThemeQuoteColor',
        '--SmartThemeBorderColor'
    ];
    const root = document.documentElement;
    variables.forEach(varName => {
        const rgb = getThemeRgb(varName);
        if (rgb) {
            root.style.setProperty(`${varName}-rgb`, rgb);
        }
    });
}
