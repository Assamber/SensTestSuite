'use strict';

let drawType = 1;          //0 - чувствительность, 1 - проценты (черный фон), 2 - проценты (синий фон)
//Геометрические параметры
let radius = 300;
let sensNumber = 10;
//Параметры ошибки позиционирования
let posErr = 0;            //Процент ошибки расположения (100% - 1)
let geoErr = 0;            //Процент ошибки геометрии (100% - 1)
let rotationErr = 0;       // +- Угол разброса сенсоров в градусах
let posRand = false;
let geoRand = false;
let rotationRand = false;
//Масштабные коэффициенты
let accuracy = 0.01;
let scale = 0.001;
let externalScale = 0.01;
let amplification = 40;
//Дополнительные элементы
let legendEnable = true;
let textEnable = true;

var vertexPositions = [
     1, -1,
    -1,  1,
     1,  1,
    -1, -1,
    -1,  1,
     1, -1
];

let canvasWidth = document.getElementById("canva").width;
let canvasHeight = document.getElementById("canva").height;
let canvasMidX = canvasWidth/2;
let canvasMidY = canvasHeight/2;

const sliderAmp = document.getElementById("rgAmp");
const statusLine = document.getElementById("status");
const canvas = document.querySelector("#canva");
const textCanv = document.getElementById("text");

const vertexSource = `#version 300 es

    in vec2 a_position;

    void main(void) {
        gl_Position = vec4(a_position[0], a_position[1], 0, 1);
    }
`;

const fragmentSource = `#version 300 es 
    precision highp float;

    uniform sampler2D u_dataX;
    uniform sampler2D u_dataY;
    uniform sampler2D u_dataRot;
    uniform sampler2D u_dataAmp;
    
    uniform int u_drawType;
    uniform vec2 u_canvasMid;
    uniform vec2 u_canvasSize;
    uniform int u_count;
    uniform int u_radius;
    uniform vec4 u_scaleCoeff;
    uniform int u_legendEnable;
    out vec4 outColor;

    vec4 getSensorData(int index)
    {
        float x = texelFetch(u_dataX, ivec2(0,index), 0)[0];
        float y = texelFetch(u_dataY, ivec2(0,index), 0)[0];
        float rot = texelFetch(u_dataRot, ivec2(0,index), 0)[0];
        float amp = texelFetch(u_dataAmp, ivec2(0,index), 0)[0];

        return vec4(x, y, rot, amp);
    }

    float getDistance(float x2, float y2, float x1, float y1)
    {
        return sqrt(pow(x2-x1,2.0) + pow(y2-y1,2.0));
    }

    float getCircleMagnitude(float x, float y, float xc, float yc)
    {
        float result = 0.0;
        float a, b, c, proj, dist, sinAlpha, cosAlpha, canon;

        for(int i = 0; i < u_count; i++)
        {
            vec4 sensorData = getSensorData(i);
            float xs = sensorData[0];
            float ys = sensorData[1];
            float sinBeta = sin(sensorData[2]);
            float cosBeta = cos(sensorData[2]);
            float amp = sensorData[3];

            if(xs == x && ys == y)
                return 0.0;

            a = getDistance(x, y, xc, yc);
            b = getDistance(xs, ys, x, y);
            c = float(u_radius);

            cosAlpha = (pow(b,2.0) + pow(c,2.0) - pow(a,2.0))/(2.0*b*c);
            dist = amp/b;
            if(abs(sensorData[2]) <= 0.00001)
                proj = cosAlpha;
            else if(cosAlpha < 1.0)
            {
                canon = (x-xc)*(ys-yc) - (y-yc)*(xs-xc);
                float cosMult = min(cosAlpha*cosAlpha, 1.0);
                sinAlpha = sign(canon)*sqrt(1.0 - cosMult);
                proj = cosAlpha*cosBeta - sinAlpha*sinBeta;
            } else
                proj = cosBeta;

            result += proj*dist;
        }

        result = result/float(u_count);
        return result;
    }

    bool checkSensorCoordinates(float x, float y)
    {
        bool result = false;
        float sensorSize = 2.0;

        for(int i = 0; i < u_count; i++)
        {
            vec4 sensorData = getSensorData(i);
            float xs = sensorData[0];
            float ys = sensorData[1];

            if(abs(x - xs) < sensorSize && abs(y - ys) < sensorSize)
            {
                result = true;
                break;
            }
        }
        
        return result;
    }

    void drawTypeSensivity(void)
    {
        if(checkSensorCoordinates(gl_FragCoord.x, gl_FragCoord.y))
        {
            outColor = vec4(0.0, 1.0, 0.0, 1.0);
            return;
        }

        float proj = getCircleMagnitude(gl_FragCoord.x, gl_FragCoord.y, u_canvasMid.x, u_canvasMid.y)*u_scaleCoeff[0];
        if(proj >= 0.0)
            outColor = vec4(proj, 0, 0, 1);
        else
            outColor = vec4(0, 0, -proj, 1);
    }

    float getPercentValue(void)
    {
        float hLegend = u_canvasSize.y/2.0;
        float wLegend = u_canvasSize.x/100.0;
        float wStart = u_canvasSize.x - wLegend - 5.0;
        float wStop = wStart + wLegend;
        float hStart = hLegend/2.0;
        float hStop = hLegend/2.0 + hLegend;

        float proj = 0.0;
        float percent = 0.0;
        
        if(gl_FragCoord.x >= wStart && gl_FragCoord.x < wStop && gl_FragCoord.y >= hStart && gl_FragCoord.y < hStop && u_legendEnable > 0)
        {
            percent = (gl_FragCoord.y - hStart)/hLegend;
            percent = -1.5 + percent*2.0;

            if(abs(gl_FragCoord.x - wStart) < 1.6 || abs(gl_FragCoord.x - wStop) < 1.6 || \
               abs(gl_FragCoord.y - hStart) < 1.6 || abs(gl_FragCoord.y - hStop) < 1.6)
                percent = -1.0
            ;
        }
        else
        {
            float middleMag = getCircleMagnitude(u_canvasMid.x, u_canvasMid.y, u_canvasMid.x, u_canvasMid.y);
            proj = getCircleMagnitude(gl_FragCoord.x, gl_FragCoord.y, u_canvasMid.x, u_canvasMid.y);

            percent = (proj-middleMag)/middleMag;
        }
        
        return percent;
    }

    void drawTypeAccuracy(void)
    {
        float percent;
        float maxBright = 0.9;
        float attenuation = 3.0;
        float accuracy = u_scaleCoeff[1];
        float scale = u_scaleCoeff[2];
        float externalScale = u_scaleCoeff[3];

        if(checkSensorCoordinates(gl_FragCoord.x, gl_FragCoord.y))
        {
            outColor = vec4(0.0, 1.0, 0.0, 1.0);
            return;
        }

        percent = getPercentValue();

        float zone = abs(percent) > accuracy ? 0.0 : accuracy - abs(percent);
        if(percent >= 0.0)
            outColor = vec4(min(percent/scale, maxBright), min(zone/accuracy, maxBright), 0.0, 1.0);
        else if (percent >= -0.5)
            outColor = vec4(0.0, min(zone/accuracy, maxBright), min(-percent/scale, maxBright), 1.0);
        else
        {
            percent = min(percent, 1.0);
            float zero = percent + 1.0;
            float rValue = min(zero/externalScale, maxBright);
            float bValue = min(-zero/externalScale, maxBright);
            float gValue = min(abs(zero)/externalScale, maxBright)/attenuation;

            outColor = vec4(rValue, gValue, bValue, 1.0);
        }
    }

    void main(void) 
    {
        switch(u_drawType)
        {
            default: drawTypeSensivity(); break;
            case 1: drawTypeAccuracy(); break;
        }
    }
`;

//Compile shader
function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
      return shader;
    }
   
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

//Link compiled shaders into program
function createProgram(gl, vertexShader, fragmentShader) {
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
      return program;
    }
   
    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

function generateCircleArray(number, rad, position, rotation, attenuation, posRand, rotRand, geoRand){
    let xArr = new Array();
    let yArr = new Array();
    let rotArr = new Array();
    let ampArr = new Array();

    let angleShift, x, y;
    for (let i = 0; i < number; i++){
        let angleShift = 2*Math.PI/number;
        let errShift = posRand ? (Math.random() - 0.5)*angleShift*position : angleShift*position;
        let x = canvasMidX + rad*Math.cos(i*angleShift + errShift);
        let y = canvasMidY + rad*Math.sin(i*angleShift + errShift);
        let rotAngle = rotRand ? rotation/180*Math.PI*Math.random() : rotation/180*Math.PI;
        let amp = geoRand ? 1 - attenuation*Math.random() : 1 - attenuation;

        xArr.push(x);
        yArr.push(y);
        rotArr.push(rotAngle);
        ampArr.push(amp);
    }
    return [xArr, yArr, rotArr, ampArr];
}

function updateCanvas()
{
    let arr = generateCircleArray(sensNumber, radius, posErr, rotationErr, geoErr, posRand, rotationRand, geoRand);

    // Initialize the GL context
    const gl = canvas.getContext("webgl2", {preserveDrawingBuffer: true});
    // Only continue if WebGL is available and working
    if (gl === null) {
        alert("Не получилось инициализировать WebGL.");
        return;
    }

    const maxBufferSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (sensNumber > maxBufferSize)
    {
        console.alert("Превышено максимальное кол-во сенсоров");
        console.log("Максимальный размер буффера: ", maxBufferSize);
        console.log("Количество сенсоров: ", sensNumber);
        return;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");

    const xDataLocation = gl.getUniformLocation(program, "u_dataX");
    const yDataLocation = gl.getUniformLocation(program, "u_dataY");
    const rotDataLocation = gl.getUniformLocation(program, "u_dataRot");
    const ampDataLocation = gl.getUniformLocation(program, "u_dataAmp");

    const drawTypeLocation = gl.getUniformLocation(program, "u_drawType");
    const canvasMidLocation = gl.getUniformLocation(program, "u_canvasMid");
    const canvasSizeLocation = gl.getUniformLocation(program, "u_canvasSize");
    const radiusLocation = gl.getUniformLocation(program, "u_radius");
    const countLocation = gl.getUniformLocation(program, "u_count");
    const legendEnableLocation = gl.getUniformLocation(program, "u_legendEnable");
    const scaleCoeffLocation = gl.getUniformLocation(program, "u_scaleCoeff");

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);

    let size = 2;          // 2 components per iteration
    let type = gl.FLOAT;   // the data is 32bit floats
    let normalize = false; // don't normalize the data
    let stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    let offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);

    let dataArr = [];
    let textures = [];
    for(let i = 0; i < 4; i++)
    {
        let tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        dataArr.push(new Float32Array(arr[i]));
    
        gl.texImage2D(
            gl.TEXTURE_2D,     // target
            0,                 // mip level
            gl.R32F,           // internal format (format in texture)
            1,                 // width
            dataArr[i].length, // height
            0,                 // border
            gl.RED,            // format of supplying data
            gl.FLOAT,          // type of supplying data
            dataArr[i] // array
        );

        textures.push(tex);
    }

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    gl.uniform1i(countLocation, arr[0].length);
    gl.uniform2fv(canvasSizeLocation, new Float32Array([canvasWidth, canvasHeight]));
    gl.uniform2fv(canvasMidLocation, new Float32Array([canvasMidX, canvasMidY]));
    gl.uniform1i(radiusLocation, radius);
    gl.uniform4fv(scaleCoeffLocation, new Float32Array([amplification, accuracy, scale, externalScale]));
    gl.uniform1i(drawTypeLocation, drawType);
    gl.uniform1i(legendEnableLocation, legendEnable);

    gl.uniform1i(xDataLocation, 0);
    gl.uniform1i(yDataLocation, 1);
    gl.uniform1i(rotDataLocation, 2);
    gl.uniform1i(ampDataLocation, 3);

    //Bind texture to unit with number = unitNumber
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[0]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures[1]);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, textures[2]);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, textures[3]);

    let primitiveType = gl.TRIANGLES;
    offset = 0;
    let count = 6;
    gl.drawArrays(primitiveType, offset, count);
}

function drawText(textEnable, legendEnable)
{
    const gl = canvas.getContext("webgl2", {preserveDrawingBuffer: true});
    if (gl === null) {
        alert("Не получилось инициализировать WebGL.");
        return;
    }
    const ctx = textCanv.getContext("2d");

    //ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(gl.canvas, 0, 0); //Копировать изображение с WebGL контекста

    let fs = 5;
    let fh = 6; //12px / 2
    let h = textCanv.height/2;
    let w = textCanv.width/100;
    let textVert = textCanv.width - w - 5;
    let textHoriz = textCanv.height - 2*fh - 15;

    if(textEnable)
    {
        ctx.font = "12px Comic Sans MS";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        let text = "Количество элементов - " + sensNumber + ", радиус - " + radius;
        if(drawType == 1)
        {
            text = text + ", G зона - " + accuracy*100 + "%," + " R/B зоны - " + scale*100 + "%";
            text = text + ", вшешние зоны " + externalScale*100 + "%";
        }
        text = text +  ", погр. расп. по окр. - " + posErr*100 + "%";
        text = text + ", вращение сенсоров " + rotationErr + "°";
        text = text + ", ошибка геометрии " + geoErr + "%";
        ctx.fillText(text, textCanv.width/2, textHoriz);
    }

    if(legendEnable && drawType == 1)
    {
        ctx.font = "12px Comic Sans MS";
        ctx.textAlign = "right";
        ctx.fillStyle = "white";
        ctx.fillText("+50%", textVert - fs, h/2 + fh);
        ctx.fillText("0%", textVert - fs, 3*h/4+ fh);
        ctx.fillText("-50%", textVert - fs, h + fh);
        ctx.fillText("-100%", textVert - fs, 5*h/4 + fh);
        ctx.fillText("-150%", textVert - fs, 3*h/2 + fh);

    }
}

function sliderRefresh()
{
    let fAmpCtrl = sliderAmp.value;
    let fAmpLabel = document.getElementById("lAmp");
    fAmpLabel.innerHTML = "Усиление (" + fAmpCtrl + ")";
}

function openInNewTab()
{
    const dataUrl = textCanv.toDataURL("png");
    console.log(dataUrl);
    window.open(dataUrl, '_blank');
}

function controlSet()
{
    let timeStamp = Date.now();
    getValuesFromForm();
    updateCanvas();
    drawText(textEnable, legendEnable);



    statusLine.innerText = "Время выполнения: " + (Date.now() - timeStamp)  + " мс";
}

function addCallbacks()
{
    sliderAmp.addEventListener("input", sliderRefresh);
    sliderAmp.addEventListener("change", controlSet);

    document.getElementById("sbDrawType").addEventListener("change", controlSet);
    document.getElementById("tbCanvWidth").addEventListener("change", controlSet);
    document.getElementById("tbCanvHeight").addEventListener("change", controlSet);
    document.getElementById("tbRadius").addEventListener("change", controlSet);
    document.getElementById("tbSensNumber").addEventListener("change", controlSet);
    document.getElementById("tbRBVzone").addEventListener("change", controlSet);
    document.getElementById("tbGzone").addEventListener("change", controlSet);
    document.getElementById("tbExtzone").addEventListener("change", controlSet);

    document.getElementById("tbPosInp").addEventListener("change", controlSet);
    document.getElementById("cbPosInpRnd").addEventListener("change", controlSet);
    document.getElementById("tbRotInp").addEventListener("change", controlSet);
    document.getElementById("cbRotInpRnd").addEventListener("change", controlSet);
    document.getElementById("tbGeoInp").addEventListener("change", controlSet);
    document.getElementById("cbGeoInpRnd").addEventListener("change", controlSet);
    document.getElementById("cbLegend").addEventListener("change", controlSet);
    document.getElementById("cbLabel").addEventListener("change", controlSet);

    document.getElementById("mergeButton").addEventListener("click",openInNewTab);
}

function getValuesFromForm()
{
    let fDrawType = Number(document.getElementById("sbDrawType").value);
    let fCanvWidth = document.getElementById("tbCanvWidth").value;
    let fCanvHeight = document.getElementById("tbCanvHeight").value;
    let fRadius = document.getElementById("tbRadius").value;
    let fSensNumber = document.getElementById("tbSensNumber").value;
    let fRBVzone = document.getElementById("tbRBVzone").value/100;
    let fGzone = document.getElementById("tbGzone").value/100;
    let fExtZone = document.getElementById("tbExtzone").value/100;

    let fPosInp = document.getElementById("tbPosInp").value/100;
    let fPosInpRand = document.getElementById("cbPosInpRnd").checked;
    let fRotInp = document.getElementById("tbRotInp").value;
    let fRotInpRand = document.getElementById("cbRotInpRnd").checked;
    let fGeoInp =  document.getElementById("tbGeoInp").value/100;
    let fGeoInpRand = document.getElementById("cbGeoInpRnd").checked;
    let fLegend = document.getElementById("cbLegend").checked;
    let fLabel = document.getElementById("cbLabel").checked;
    let fAmp = sliderAmp.value;

    if (canvas.width != fCanvWidth || canvas.height != fCanvHeight)
    {
        canvas.width = fCanvWidth;
        canvas.height = fCanvHeight;
        textCanv.width = fCanvWidth;
        textCanv.height = fCanvHeight;

        canvasWidth = canvas.width;
        canvasHeight = canvas.height;
        canvasMidX = canvasWidth/2;
        canvasMidY = canvasHeight/2;
        console.log("Обновлена канва!")
    }

    amplification = fAmp;
    radius = fRadius;
    sensNumber = fSensNumber;
    drawType = fDrawType;
    accuracy = fGzone;
    scale = fRBVzone;
    externalScale = fExtZone;
    posRand = fPosInpRand;
    geoRand = fGeoInpRand;
    rotationRand = fRotInpRand;
    posErr = fPosInp;
    geoErr = fGeoInp;
    rotationErr = fRotInp;
    legendEnable = fLegend;
    textEnable = fLabel;
}

function main() {
    let timeStamp = Date.now();

    sliderRefresh()
    updateCanvas()
    drawText(textEnable, legendEnable);
    addCallbacks()

    console.log("Время выполнения: ", (Date.now() - timeStamp), " мс");
    statusLine.innerText = "Время выполнения: " + (Date.now() - timeStamp)  + " мс";
}

main();