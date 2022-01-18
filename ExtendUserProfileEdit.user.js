// ==UserScript==
// @name         ExtendUserProfileEdit
// @namespace    https://github.com/Exsper/
// @supportURL   https://github.com/Exsper/osuweb-tools/issues
// @version      1.0.0.0
// @description  扩展修改个人介绍功能
// @author       Exsper
// @match        https://osu.ppy.sh/users/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

class RGB {
    /**
     * @param {number} r 
     * @param {number} g 
     * @param {number} b 
     */
    constructor(r, g, b) {
        this.r = this.limitInt(parseInt(r), 0, 255);
        this.g = this.limitInt(parseInt(g), 0, 255);
        this.b = this.limitInt(parseInt(b), 0, 255);
    }

    /**
     * @param {number} num 
     * @param {number} min 
     * @param {number} max 
     * @returns {number}
     */
    limitInt(num, min, max) {
        if (num < min) return min;
        else if (num > max) return max;
        else return num;
    }

    /**
     * @param {number} dec 
     * @returns {string}
     */
    DEC2HEX(dec) {
        let s = dec.toString(16);
        if (s.length < 2) s = "0" + s;
        return s;
    }

    /**
     * @returns {[number,number,number]}
     */
    toHSV() {
        let [R, G, B] = [this.r / 255, this.g / 255, this.b / 255];
        let [H, S, V] = [0, 0, 0];
        let max = Math.max(R, G, B);
        let min = Math.min(R, G, B);
        V = max;
        S = (max - min) / max;
        if (R === max) H = (G - B) / (max - min) * 60;
        if (G === max) H = 120 + (B - R) / (max - min) * 60;
        if (B === max) H = 240 + (R - G) / (max - min) * 60;
        if (H < 0) H = H + 360;
        return [H, S, V];
    }

    toString() {
        return "#" + this.DEC2HEX(this.r) + this.DEC2HEX(this.g) + this.DEC2HEX(this.b);
    }
}

class HSV {
    /**
     * @param {number} h 
     * @param {number} s 
     * @param {number} v 
     */
    constructor(h, s, v) {
        this.h = this.limitInt(parseFloat(h), 0, 360);
        this.s = this.limitInt(parseFloat(s), 0, 1);
        this.v = this.limitInt(parseFloat(v), 0, 1);
    }

    /**
    * @param {number} num 
    * @param {number} min 
    * @param {number} max 
    * @returns {number}
    */
    limitInt(num, min, max) {
        if (num < min) return min;
        else if (num > max) return max;
        else return num;
    }

    /**
     * @returns {[number,number,number]}
     */
    toRGB() {
        let [H, S, V] = [this.h, this.s, this.v];
        let [R, G, B] = [0, 0, 0];
        if (S === 0) R = G = B = V;
        else {
            H /= 60;
            let i = Math.floor(H);
            let f = H - i;
            let a = V * (1 - S);
            let b = V * (1 - S * f);
            let c = V * (1 - S * (1 - f));
            switch (i) {
                case 0: R = V; G = c; B = a; break;
                case 1: R = b; G = V; B = a; break;
                case 2: R = a; G = V; B = c; break;
                case 3: R = a; G = b; B = V; break;
                case 4: R = c; G = a; B = V; break;
                case 5: R = V; G = a; B = b; break;
                default: console.log("HSV2color Error");
            }
            R = Math.floor(R * 255);
            G = Math.floor(G * 255);
            B = Math.floor(B * 255);
            return [R, G, B];
        }
    }
}

class Color {
    /**
     * @param {string|Array<number>} param "#AAFF00" or [170,255,0]
     * @param {boolean} isRGB if param is array, true: RGB, false: HSV
     */
    constructor(param, isRGB = true) {
        if (typeof param === "string") {
            this.rgb = new RGB(...this.colorText2RGB(param));
            this.hsv = new HSV(...this.rgb.toHSV());
        }
        else if (isRGB) {
            this.rgb = new RGB(...param);
            this.hsv = new HSV(...this.rgb.toHSV());
        }
        else {
            this.hsv = new HSV(...param);
            this.rgb = new RGB(...this.hsv.toRGB());
        }
    }

    /**
     * @param {string} colorText RGB code as #AAFF00
     * @returns {[number,number,number]} [r,g,b]
     */
    colorText2RGB(colorText) {
        let rgb = [];
        for (let i = 1; i < 7; i += 2) {
            rgb.push(parseInt('0x' + colorText.substr(i, 2)));
        }
        return rgb;
    }

    toString() {
        return this.rgb.toString();
    }

}



class ColorGenerator {
    /**
     * @param {Array<string>} words 
     * @param {Color} startColor 
     * @param {Color} endColor 
     */
    constructor(words, startColor, endColor) {
        this.words = words;
        this.startColor = startColor;
        this.endColor = endColor;
    }

    /**
     * 返回该点颜色渐变占总渐变的比值，0-1
     * @param {number} index
     * @returns {number}
     */
    calColorRatio(index) {
        return index / this.words.length;
    }

    /**
     * @param {number} begin 
     * @param {number} end 
     * @param {number} ratio 0-1
     * @returns {number}
     */
    getInnerNum(begin, end, ratio) {
        return begin + (end - begin) * ratio;
    }

    createColorsByRGB() {
        const startR = this.startColor.rgb.r;
        const endR = this.endColor.rgb.r;
        const startG = this.startColor.rgb.g;
        const endG = this.endColor.rgb.g;
        const startB = this.startColor.rgb.b;
        const endB = this.endColor.rgb.b;
        const colors = this.words.map((word, index)=> {
            if (word === "\n" || word === " ") return null;
            let ratio = this.calColorRatio(index);
            let r = this.getInnerNum(startR, endR, ratio);
            let g = this.getInnerNum(startG, endG, ratio);
            let b = this.getInnerNum(startB, endB, ratio);
            let color = new Color([r, g, b], true);
            return color.toString();
        });
        return colors;
    }

    createColorsByHSV() {
        const startH = this.startColor.hsv.h;
        const endH = this.endColor.hsv.h;
        const startS = this.startColor.hsv.s;
        const endS = this.endColor.hsv.s;
        const startV = this.startColor.hsv.v;
        const endV = this.endColor.hsv.v;
        const colors = this.words.map((word, index)=> {
            if (word === "\n" || word === " ") return null;
            let ratio = this.calColorRatio(index);
            let h = this.getInnerNum(startH, endH, ratio);
            let s = this.getInnerNum(startS, endS, ratio);
            let v = this.getInnerNum(startV, endV, ratio);
            let color = new Color([h, s, v], false);
            return color.toString();
        });
        return colors;
    }

    /**
     * @param {string} colorType RGB/HSV
     */
    applyColors(colorType = "HSV") {
        if (colorType === "HSV") {
            return this.createColorsByHSV();
        }
        else {
            return this.createColorsByRGB();
        }
    }
}

const bbcodeCenter = {
    default() { return "[centre][/centre]";},
    bbcode(text_old) {
        return "[centre]" + text_old + "[/centre]";
    }
}

const bbcodeSingleColor = {
    default() {
        let color = new Color(document.getElementById("eupe-color1").value);
        return "[color=" + color.toString() + "][/color]";
    },
    bbcode(text_old) {
        let color = new Color(document.getElementById("eupe-color1").value);
        return "[color=" + color.toString() + "]" + text_old + "[/color]";
    }
}

const bbcodeColors = {
    default() {
        return "";
    },
    bbcode(text_old) {
        let startColor = new Color(document.getElementById("eupe-color1").value);
        let endColor = new Color(document.getElementById("eupe-color2").value);
        let lines = text_old.split("\n");
        let new_lines = lines.map((line) => {
            let words = line.split("");
            let cg = new ColorGenerator(words, startColor, endColor);
            let colors = cg.applyColors("HSV");
            let code = [];
            words.map((word, index) => {
                if (word === "\n") code[index] = "\n";
                else if (word === " ") code[index] = " ";
                else code[index] = "[color=" + colors[index] + "]" + word + "[/color]";
            });
            return code.join("");
        });
        return new_lines.join("\n");
    }
}

function insertBBcode(bbcodeFunc) {
    let $editorTextarea = $(".bbcode-editor__body")[0];
    let startIndex = $editorTextarea.selectionStart;
    let endIndex = $editorTextarea.selectionEnd;
    let restoreTop = $editorTextarea.scrollTop;
    if (startIndex === endIndex) {
        let appendText = bbcodeFunc.default();
        if (appendText !== "") {
            $editorTextarea.value = $editorTextarea.value.substring(0, startIndex) + appendText + $editorTextarea.value.substring(endIndex, $editorTextarea.value.length);
            $editorTextarea.focus();
            $editorTextarea.selectionStart = startIndex;
            $editorTextarea.selectionEnd = startIndex + appendText.length;
            $editorTextarea.scrollTop = restoreTop;
        }
    }
    else {
        let text_old = $editorTextarea.value.substr(startIndex, endIndex - startIndex);
        let appendText = bbcodeFunc.bbcode(text_old);
        if (appendText !== "") {
            $editorTextarea.value = $editorTextarea.value.substring(0, startIndex) + appendText + $editorTextarea.value.substring(endIndex, $editorTextarea.value.length);
            $editorTextarea.focus();
            $editorTextarea.selectionStart = startIndex;
            $editorTextarea.selectionEnd = startIndex + appendText.length;
            $editorTextarea.scrollTop = restoreTop;
        }
    }
}

function startScrpit() {
    let $toolbar = $(".post-box-toolbar");
    let $scriptDiv = $("<div>", { id: "eupe-div", class: "post-box-toolbar", style: "margin-left: 10px;"});
    $toolbar.after($scriptDiv);
    let $centerButton = $('<div>', { class: "btn-circle btn-circle--bbcode" }).appendTo($scriptDiv);
    let $centerLabel = $("<span>", { text: "居中", class: "btn-circle__content" }).appendTo($centerButton);
    $centerButton.click(() => {
        insertBBcode(bbcodeCenter);
    });
    let $singleColorButton = $('<div>', { class: "btn-circle btn-circle--bbcode" }).appendTo($scriptDiv);
    let $singleColorLabel = $("<span>", { text: "单色", class: "btn-circle__content" }).appendTo($singleColorButton);
    $singleColorButton.click(() => {
        insertBBcode(bbcodeSingleColor);
    });
    let $colorsButton = $('<div>', { class: "btn-circle btn-circle--bbcode" }).appendTo($scriptDiv);
    let $colorsLabel = $("<span>", { text: "渐变", class: "btn-circle__content" }).appendTo($colorsButton);
    $colorsButton.click(() => {
        insertBBcode(bbcodeColors);
    });

    let $colorSelect1 = $('<input>', { type:"color", id: "eupe-color1", class: "btn-circle btn-circle--bbcode" }).appendTo($scriptDiv);
    let $colorSelect2 = $('<input>', { type:"color", id: "eupe-color2", class: "btn-circle btn-circle--bbcode" }).appendTo($scriptDiv);
    document.getElementById("eupe-color1").value = "#fe12ef";
    document.getElementById("eupe-color2").value = "#21feef";
}


// 确保网页加载完成
function check() {
    let $script = $("#eupe-div");
    let $toolbar = $(".post-box-toolbar");
    if ($script.length <= 0) {
        if ($toolbar.length > 0) {
            startScrpit();
            // 局部刷新重新加载
            let interval = setInterval(() => {
                // console.log("检查脚本框架");
                if ($("#eupe-div").length <= 0) {
                    // console.log("检查到页面局部刷新");
                    clearInterval(interval);
                    check();
                }
            }, 5000);
        }
        else setTimeout(function () { check(); }, 2000);
    }

}

$(document).ready(() => {
    check();
});
