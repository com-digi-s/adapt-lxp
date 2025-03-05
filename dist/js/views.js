import { SeamlessIframe } from '../libraries/seamless-iframe';

var myHtml = sanitize("<div>hello</div>"); // HTML sanitisation is still recommended.

export var DashBoard = function DashBoard(props) {
    return React.createElement(SeamlessIframe, {
        sanitizedHtml: myHtml,
        customStyle: "\n                body {\n                    font-family: sans-serif;\n                }\n            "
    });
};