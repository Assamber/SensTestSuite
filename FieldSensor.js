'use strict';

let drawType = 1;          //0 - чувствительность, 1 - проценты (черный фон), 2 - проценты (синий фон)
//Геометрические параметры
let radius = 300;
let sensNumber = 300;
//Параметры ошибки позиционирования
let posErr = 0;            //Процент ошибки расположения (100% - 1)
let geoErr = 0;            //Процент ошибки геометрии (100% - 1)
let rotationErr = 0;       // +- Угол разброса сенсоров в градусах
//Масштабные коэффициенты
let accuracy = 0.01;
let scale = 0.001;
let externalScale = 0.01;
let amplification = 40;

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
    uniform int u_count;
    uniform int u_radius;
    uniform vec4 u_scaleCoeff;
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
            if(sensorData[2] == 0.0)
                proj = cosAlpha;
            else if(cosAlpha < 1.0)
            {
                canon = (x-xc)*(ys-yc) - (y-yc)*(xs-xc);
                sinAlpha = sign(canon)*sqrt(1.0 - cosAlpha*cosAlpha);
                proj = cosAlpha*cosBeta - sinAlpha*sinBeta;
            } else
                proj = cosBeta;

            result += proj*dist;
        }

        result = result/float(u_count);
        return result;
    }

    void drawTypeSensivity(void)
    {
        float proj = getCircleMagnitude(gl_FragCoord.x, gl_FragCoord.y, u_canvasMid.x, u_canvasMid.y)*u_scaleCoeff[0];
        if(proj >= 0.0)
            outColor = vec4(proj, 0, 0, 1);
        else
            outColor = vec4(0, 0, -proj, 1);
    }

    void drawTypeAccuracy(void)
    {
        float maxBright = 0.9;
        float attenuation = 3.0;
        float accuracy = u_scaleCoeff[1];
        float scale = u_scaleCoeff[2];
        float externalScale = u_scaleCoeff[3];

        float proj = getCircleMagnitude(gl_FragCoord.x, gl_FragCoord.y, u_canvasMid.x, u_canvasMid.y);
        float middleMag = getCircleMagnitude(u_canvasMid.x, u_canvasMid.y, u_canvasMid.x, u_canvasMid.y);
        float percent = (proj-middleMag)/middleMag;


        float zone = abs(percent) > accuracy ? 0.0 : accuracy - abs(percent);
        if(percent >= 0.0)
            outColor = vec4(min(percent/scale, maxBright), min(zone/accuracy, maxBright), 0, 1);
        else if (percent >= -0.5)
            outColor = vec4(0, min(zone/accuracy, maxBright), min(-percent/scale, maxBright), 1);
        else
        {
            float zero = percent + 1.0;
            float rValue = min(zero/externalScale, maxBright);
            float bValue = min(-zero/externalScale, maxBright);
            float gValue = min(abs(zero)/externalScale, maxBright)/attenuation;
            outColor = vec4(rValue, gValue, bValue, 1);
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
}

function updateCanvas
{

}


function main() {
    let timeStamp = Date.now();

    let arr = generateCircleArray(sensNumber, radius, posErr, rotationErr, geoErr, true, true, true);

    const canvas = document.querySelector("#canva");
    // Initialize the GL context
    const gl = canvas.getContext("webgl2");
    // Only continue if WebGL is available and working
    if (gl === null) {
        alert("Не получилось инициализировать WebGL.");
        return;
    }

    const maxBufferSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    console.log("Максимальный размер буффера: ", maxBufferSize);
    console.log("Количество сенсоров: ", sensNumber);

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
    const radiusLocation = gl.getUniformLocation(program, "u_radius");
    const countLocation = gl.getUniformLocation(program, "u_count");
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

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    gl.uniform1i(countLocation, arr[0].length);
    gl.uniform2fv(canvasMidLocation, new Float32Array([canvasMidX, canvasMidY]));
    gl.uniform1i(radiusLocation, radius);
    gl.uniform4fv(scaleCoeffLocation, new Float32Array([amplification, accuracy, scale, externalScale]));
    gl.uniform1i(drawTypeLocation, drawType);

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

    console.log("Размер поля W = " + canvas.width + ", H = " + canvas.height);
    console.log("Время выполнения: ", (Date.now() - timeStamp)/1000, "секунд");
}

main();