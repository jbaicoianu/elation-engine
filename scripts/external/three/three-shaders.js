/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Full-screen textured quad shader
 */

THREE.CopyShader = {

	uniforms: {

		"tDiffuse": { value: null },
		"opacity":  { value: 1.0 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform float opacity;",

		"uniform sampler2D tDiffuse;",

		"varying vec2 vUv;",

		"void main() {",

			"vec4 texel = texture2D( tDiffuse, vUv );",
			"gl_FragColor = opacity * texel;",

		"}"

	].join( "\n" )

};
/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Convolution shader
 * ported from o3d sample to WebGL / GLSL
 * http://o3d.googlecode.com/svn/trunk/samples/convolution.html
 */

THREE.ConvolutionShader = {

	defines: {

		"KERNEL_SIZE_FLOAT": "25.0",
		"KERNEL_SIZE_INT": "25"

	},

	uniforms: {

		"tDiffuse":        { value: null },
		"uImageIncrement": { value: new THREE.Vector2( 0.001953125, 0.0 ) },
		"cKernel":         { value: [] }

	},

	vertexShader: [

		"uniform vec2 uImageIncrement;",

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv - ( ( KERNEL_SIZE_FLOAT - 1.0 ) / 2.0 ) * uImageIncrement;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform float cKernel[ KERNEL_SIZE_INT ];",

		"uniform sampler2D tDiffuse;",
		"uniform vec2 uImageIncrement;",

		"varying vec2 vUv;",

		"void main() {",

			"vec2 imageCoord = vUv;",
			"vec4 sum = vec4( 0.0, 0.0, 0.0, 0.0 );",

			"for( int i = 0; i < KERNEL_SIZE_INT; i ++ ) {",

				"sum += texture2D( tDiffuse, imageCoord ) * cKernel[ i ];",
				"imageCoord += uImageIncrement;",

			"}",

			"gl_FragColor = sum;",

		"}"


	].join( "\n" ),

	buildKernel: function ( sigma ) {

		// We lop off the sqrt(2 * pi) * sigma term, since we're going to normalize anyway.

		function gauss( x, sigma ) {

			return Math.exp( - ( x * x ) / ( 2.0 * sigma * sigma ) );

		}

		var i, values, sum, halfWidth, kMaxKernelSize = 25, kernelSize = 2 * Math.ceil( sigma * 3.0 ) + 1;

		if ( kernelSize > kMaxKernelSize ) kernelSize = kMaxKernelSize;
		halfWidth = ( kernelSize - 1 ) * 0.5;

		values = new Array( kernelSize );
		sum = 0.0;
		for ( i = 0; i < kernelSize; ++ i ) {

			values[ i ] = gauss( i - halfWidth, sigma );
			sum += values[ i ];

		}

		// normalize the kernel

		for ( i = 0; i < kernelSize; ++ i ) values[ i ] /= sum;

		return values;

	}

};
/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Screen-space ambient occlusion shader
 * - ported from
 *   SSAO GLSL shader v1.2
 *   assembled by Martins Upitis (martinsh) (http://devlog-martinsh.blogspot.com)
 *   original technique is made by ArKano22 (http://www.gamedev.net/topic/550699-ssao-no-halo-artifacts/)
 * - modifications
 * - modified to use RGBA packed depth texture (use clear color 1,1,1,1 for depth pass)
 * - refactoring and optimizations
 */

THREE.SSAOShader = {

	uniforms: {

		"tDiffuse":     { value: null },
		"tDepth":       { value: null },
		"size":         { value: new THREE.Vector2( 512, 512 ) },
		"cameraNear":   { value: 1 },
		"cameraFar":    { value: 100 },
		"radius":       { value: 32 },
		"onlyAO":       { value: 0 },
		"aoClamp":      { value: 0.25 },
		"lumInfluence": { value: 0.7 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform float cameraNear;",
		"uniform float cameraFar;",
		"#ifdef USE_LOGDEPTHBUF",
			"uniform float logDepthBufFC;",
		"#endif",

		"uniform float radius;",     // ao radius
		"uniform bool onlyAO;",      // use only ambient occlusion pass?

		"uniform vec2 size;",        // texture width, height
		"uniform float aoClamp;",    // depth clamp - reduces haloing at screen edges

		"uniform float lumInfluence;",  // how much luminance affects occlusion

		"uniform sampler2D tDiffuse;",
		"uniform sampler2D tDepth;",

		"varying vec2 vUv;",

		// "#define PI 3.14159265",
		"#define DL 2.399963229728653",  // PI * ( 3.0 - sqrt( 5.0 ) )
		"#define EULER 2.718281828459045",

		// user variables

		"const int samples = 64;",     // ao sample count

		"const bool useNoise = true;",      // use noise instead of pattern for sample dithering
		"const float noiseAmount = 0.0004;", // dithering amount

		"const float diffArea = 0.4;",   // self-shadowing reduction
		"const float gDisplace = 0.4;",  // gauss bell center


		// RGBA depth

		"#include <packing>",

		// generating noise / pattern texture for dithering

		"vec2 rand( const vec2 coord ) {",

			"vec2 noise;",

			"if ( useNoise ) {",

				"float nx = dot ( coord, vec2( 12.9898, 78.233 ) );",
				"float ny = dot ( coord, vec2( 12.9898, 78.233 ) * 2.0 );",

				"noise = clamp( fract ( 43758.5453 * sin( vec2( nx, ny ) ) ), 0.0, 1.0 );",

			"} else {",

				"float ff = fract( 1.0 - coord.s * ( size.x / 2.0 ) );",
				"float gg = fract( coord.t * ( size.y / 2.0 ) );",

				"noise = vec2( 0.25, 0.75 ) * vec2( ff ) + vec2( 0.75, 0.25 ) * gg;",

			"}",

			"return ( noise * 2.0  - 1.0 ) * noiseAmount;",

		"}",

		"float readDepth( const in vec2 coord ) {",

			"float cameraFarPlusNear = cameraFar + cameraNear;",
			"float cameraFarMinusNear = cameraFar - cameraNear;",
			"float cameraCoef = 2.0 * cameraNear;",

			"#ifdef USE_LOGDEPTHBUF",

				"float logz = unpackRGBAToDepth( texture2D( tDepth, coord ) );",
				"float w = pow(2.0, (logz / logDepthBufFC)) - 1.0;",
				"float z = (logz / w) + 1.0;",

			"#else",

				"float z = unpackRGBAToDepth( texture2D( tDepth, coord ) );",

			"#endif",

			"return cameraCoef / ( cameraFarPlusNear - z * cameraFarMinusNear );",


		"}",

		"float compareDepths( const in float depth1, const in float depth2, inout int far ) {",

			"float garea = 8.0;",                         // gauss bell width
			"float diff = ( depth1 - depth2 ) * 100.0;",  // depth difference (0-100)

			// reduce left bell width to avoid self-shadowing

			"if ( diff < gDisplace ) {",

				"garea = diffArea;",

			"} else {",

				"far = 1;",

			"}",

			"float dd = diff - gDisplace;",
			"float gauss = pow( EULER, -2.0 * ( dd * dd ) / ( garea * garea ) );",
			"return gauss;",

		"}",

		"float calcAO( float depth, float dw, float dh ) {",

			"vec2 vv = vec2( dw, dh );",

			"vec2 coord1 = vUv + radius * vv;",
			"vec2 coord2 = vUv - radius * vv;",

			"float temp1 = 0.0;",
			"float temp2 = 0.0;",

			"int far = 0;",
			"temp1 = compareDepths( depth, readDepth( coord1 ), far );",

			// DEPTH EXTRAPOLATION

			"if ( far > 0 ) {",

				"temp2 = compareDepths( readDepth( coord2 ), depth, far );",
				"temp1 += ( 1.0 - temp1 ) * temp2;",

			"}",

			"return temp1;",

		"}",

		"void main() {",

			"vec2 noise = rand( vUv );",
			"float depth = readDepth( vUv );",

			"float tt = clamp( depth, aoClamp, 1.0 );",

			"float w = ( 1.0 / size.x ) / tt + ( noise.x * ( 1.0 - noise.x ) );",
			"float h = ( 1.0 / size.y ) / tt + ( noise.y * ( 1.0 - noise.y ) );",

			"float ao = 0.0;",

			"float dz = 1.0 / float( samples );",
			"float l = 0.0;",
			"float z = 1.0 - dz / 2.0;",

			"for ( int i = 0; i <= samples; i ++ ) {",

				"float r = sqrt( 1.0 - z );",

				"float pw = cos( l ) * r;",
				"float ph = sin( l ) * r;",
				"ao += calcAO( depth, pw * w, ph * h );",
				"z = z - dz;",
				"l = l + DL;",

			"}",

			"ao /= float( samples );",
			"ao = 1.0 - ao;",

			"vec3 color = texture2D( tDiffuse, vUv ).rgb;",

			"vec3 lumcoeff = vec3( 0.299, 0.587, 0.114 );",
			"float lum = dot( color.rgb, lumcoeff );",
			"vec3 luminance = vec3( lum );",

			"vec3 final = vec3( color * mix( vec3( ao ), vec3( 1.0 ), luminance * lumInfluence ) );",  // mix( color * ao, white, luminance )

			"if ( onlyAO ) {",

				"final = vec3( mix( vec3( ao ), vec3( 1.0 ), luminance * lumInfluence ) );",  // ambient occlusion only

			"}",

			"gl_FragColor = vec4( final, 1.0 );",

		"}"

	].join( "\n" )

};
/**
 * @author alteredq / http://alteredqualia.com/
 * @author davidedc / http://www.sketchpatch.net/
 *
 * NVIDIA FXAA by Timothy Lottes
 * http://timothylottes.blogspot.com/2011/06/fxaa3-source-released.html
 * - WebGL port by @supereggbert
 * http://www.glge.org/demos/fxaa/
 */

THREE.FXAAShader = {

	uniforms: {

		"tDiffuse":   { value: null },
		"resolution": { value: new THREE.Vector2( 1 / 1024, 1 / 512 ) }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [
        "precision highp float;",
        "",
        "uniform sampler2D tDiffuse;",
        "",
        "uniform vec2 resolution;",
        "",
        "varying vec2 vUv;",
        "",
        "// FXAA 3.11 implementation by NVIDIA, ported to WebGL by Agost Biro (biro@archilogic.com)",
        "",
        "//----------------------------------------------------------------------------------",
        "// File:        es3-kepler\FXAA\assets\shaders/FXAA_DefaultES.frag",
        "// SDK Version: v3.00",
        "// Email:       gameworks@nvidia.com",
        "// Site:        http://developer.nvidia.com/",
        "//",
        "// Copyright (c) 2014-2015, NVIDIA CORPORATION. All rights reserved.",
        "//",
        "// Redistribution and use in source and binary forms, with or without",
        "// modification, are permitted provided that the following conditions",
        "// are met:",
        "//  * Redistributions of source code must retain the above copyright",
        "//    notice, this list of conditions and the following disclaimer.",
        "//  * Redistributions in binary form must reproduce the above copyright",
        "//    notice, this list of conditions and the following disclaimer in the",
        "//    documentation and/or other materials provided with the distribution.",
        "//  * Neither the name of NVIDIA CORPORATION nor the names of its",
        "//    contributors may be used to endorse or promote products derived",
        "//    from this software without specific prior written permission.",
        "//",
        "// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ``AS IS'' AND ANY",
        "// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE",
        "// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR",
        "// PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR",
        "// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,",
        "// EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,",
        "// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR",
        "// PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY",
        "// OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT",
        "// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE",
        "// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.",
        "//",
        "//----------------------------------------------------------------------------------",
        "",
        "#define FXAA_PC 1",
        "#define FXAA_GLSL_100 1",
        "#define FXAA_QUALITY_PRESET 12",
        "",
        "#define FXAA_GREEN_AS_LUMA 1",
        "",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_PC_CONSOLE",
        "    //",
        "    // The console algorithm for PC is included",
        "    // for developers targeting really low spec machines.",
        "    // Likely better to just run FXAA_PC, and use a really low preset.",
        "    //",
        "    #define FXAA_PC_CONSOLE 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_GLSL_120",
        "    #define FXAA_GLSL_120 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_GLSL_130",
        "    #define FXAA_GLSL_130 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_HLSL_3",
        "    #define FXAA_HLSL_3 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_HLSL_4",
        "    #define FXAA_HLSL_4 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_HLSL_5",
        "    #define FXAA_HLSL_5 0",
        "#endif",
        "/*==========================================================================*/",
        "#ifndef FXAA_GREEN_AS_LUMA",
        "    //",
        "    // For those using non-linear color,",
        "    // and either not able to get luma in alpha, or not wanting to,",
        "    // this enables FXAA to run using green as a proxy for luma.",
        "    // So with this enabled, no need to pack luma in alpha.",
        "    //",
        "    // This will turn off AA on anything which lacks some amount of green.",
        "    // Pure red and blue or combination of only R and B, will get no AA.",
        "    //",
        "    // Might want to lower the settings for both,",
        "    //    fxaaConsoleEdgeThresholdMin",
        "    //    fxaaQualityEdgeThresholdMin",
        "    // In order to insure AA does not get turned off on colors",
        "    // which contain a minor amount of green.",
        "    //",
        "    // 1 = On.",
        "    // 0 = Off.",
        "    //",
        "    #define FXAA_GREEN_AS_LUMA 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_EARLY_EXIT",
        "    //",
        "    // Controls algorithm's early exit path.",
        "    // On PS3 turning this ON adds 2 cycles to the shader.",
        "    // On 360 turning this OFF adds 10ths of a millisecond to the shader.",
        "    // Turning this off on console will result in a more blurry image.",
        "    // So this defaults to on.",
        "    //",
        "    // 1 = On.",
        "    // 0 = Off.",
        "    //",
        "    #define FXAA_EARLY_EXIT 1",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_DISCARD",
        "    //",
        "    // Only valid for PC OpenGL currently.",
        "    // Probably will not work when FXAA_GREEN_AS_LUMA = 1.",
        "    //",
        "    // 1 = Use discard on pixels which don't need AA.",
        "    //     For APIs which enable concurrent TEX+ROP from same surface.",
        "    // 0 = Return unchanged color on pixels which don't need AA.",
        "    //",
        "    #define FXAA_DISCARD 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_FAST_PIXEL_OFFSET",
        "    //",
        "    // Used for GLSL 120 only.",
        "    //",
        "    // 1 = GL API supports fast pixel offsets",
        "    // 0 = do not use fast pixel offsets",
        "    //",
        "    #ifdef GL_EXT_gpu_shader4",
        "        #define FXAA_FAST_PIXEL_OFFSET 1",
        "    #endif",
        "    #ifdef GL_NV_gpu_shader5",
        "        #define FXAA_FAST_PIXEL_OFFSET 1",
        "    #endif",
        "    #ifdef GL_ARB_gpu_shader5",
        "        #define FXAA_FAST_PIXEL_OFFSET 1",
        "    #endif",
        "    #ifndef FXAA_FAST_PIXEL_OFFSET",
        "        #define FXAA_FAST_PIXEL_OFFSET 0",
        "    #endif",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_GATHER4_ALPHA",
        "    //",
        "    // 1 = API supports gather4 on alpha channel.",
        "    // 0 = API does not support gather4 on alpha channel.",
        "    //",
        "    #if (FXAA_HLSL_5 == 1)",
        "        #define FXAA_GATHER4_ALPHA 1",
        "    #endif",
        "    #ifdef GL_ARB_gpu_shader5",
        "        #define FXAA_GATHER4_ALPHA 1",
        "    #endif",
        "    #ifdef GL_NV_gpu_shader5",
        "        #define FXAA_GATHER4_ALPHA 1",
        "    #endif",
        "    #ifndef FXAA_GATHER4_ALPHA",
        "        #define FXAA_GATHER4_ALPHA 0",
        "    #endif",
        "#endif",
        "",
        "",
        "/*============================================================================",
        "                        FXAA QUALITY - TUNING KNOBS",
        "------------------------------------------------------------------------------",
        "NOTE the other tuning knobs are now in the shader function inputs!",
        "============================================================================*/",
        "#ifndef FXAA_QUALITY_PRESET",
        "    //",
        "    // Choose the quality preset.",
        "    // This needs to be compiled into the shader as it effects code.",
        "    // Best option to include multiple presets is to",
        "    // in each shader define the preset, then include this file.",
        "    //",
        "    // OPTIONS",
        "    // -----------------------------------------------------------------------",
        "    // 10 to 15 - default medium dither (10=fastest, 15=highest quality)",
        "    // 20 to 29 - less dither, more expensive (20=fastest, 29=highest quality)",
        "    // 39       - no dither, very expensive",
        "    //",
        "    // NOTES",
        "    // -----------------------------------------------------------------------",
        "    // 12 = slightly faster then FXAA 3.9 and higher edge quality (default)",
        "    // 13 = about same speed as FXAA 3.9 and better than 12",
        "    // 23 = closest to FXAA 3.9 visually and performance wise",
        "    //  _ = the lowest digit is directly related to performance",
        "    // _  = the highest digit is directly related to style",
        "    //",
        "    #define FXAA_QUALITY_PRESET 12",
        "#endif",
        "",
        "",
        "/*============================================================================",
        "",
        "                           FXAA QUALITY - PRESETS",
        "",
        "============================================================================*/",
        "",
        "/*============================================================================",
        "                     FXAA QUALITY - MEDIUM DITHER PRESETS",
        "============================================================================*/",
        "#if (FXAA_QUALITY_PRESET == 10)",
        "    #define FXAA_QUALITY_PS 3",
        "    #define FXAA_QUALITY_P0 1.5",
        "    #define FXAA_QUALITY_P1 3.0",
        "    #define FXAA_QUALITY_P2 12.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 11)",
        "    #define FXAA_QUALITY_PS 4",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 3.0",
        "    #define FXAA_QUALITY_P3 12.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 12)",
        "    #define FXAA_QUALITY_PS 5",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 4.0",
        "    #define FXAA_QUALITY_P4 12.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 13)",
        "    #define FXAA_QUALITY_PS 6",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 4.0",
        "    #define FXAA_QUALITY_P5 12.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 14)",
        "    #define FXAA_QUALITY_PS 7",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 4.0",
        "    #define FXAA_QUALITY_P6 12.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 15)",
        "    #define FXAA_QUALITY_PS 8",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 2.0",
        "    #define FXAA_QUALITY_P6 4.0",
        "    #define FXAA_QUALITY_P7 12.0",
        "#endif",
        "",
        "/*============================================================================",
        "                     FXAA QUALITY - LOW DITHER PRESETS",
        "============================================================================*/",
        "#if (FXAA_QUALITY_PRESET == 20)",
        "    #define FXAA_QUALITY_PS 3",
        "    #define FXAA_QUALITY_P0 1.5",
        "    #define FXAA_QUALITY_P1 2.0",
        "    #define FXAA_QUALITY_P2 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 21)",
        "    #define FXAA_QUALITY_PS 4",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 22)",
        "    #define FXAA_QUALITY_PS 5",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 23)",
        "    #define FXAA_QUALITY_PS 6",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 24)",
        "    #define FXAA_QUALITY_PS 7",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 3.0",
        "    #define FXAA_QUALITY_P6 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 25)",
        "    #define FXAA_QUALITY_PS 8",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 2.0",
        "    #define FXAA_QUALITY_P6 4.0",
        "    #define FXAA_QUALITY_P7 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 26)",
        "    #define FXAA_QUALITY_PS 9",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 2.0",
        "    #define FXAA_QUALITY_P6 2.0",
        "    #define FXAA_QUALITY_P7 4.0",
        "    #define FXAA_QUALITY_P8 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 27)",
        "    #define FXAA_QUALITY_PS 10",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 2.0",
        "    #define FXAA_QUALITY_P6 2.0",
        "    #define FXAA_QUALITY_P7 2.0",
        "    #define FXAA_QUALITY_P8 4.0",
        "    #define FXAA_QUALITY_P9 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 28)",
        "    #define FXAA_QUALITY_PS 11",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 2.0",
        "    #define FXAA_QUALITY_P6 2.0",
        "    #define FXAA_QUALITY_P7 2.0",
        "    #define FXAA_QUALITY_P8 2.0",
        "    #define FXAA_QUALITY_P9 4.0",
        "    #define FXAA_QUALITY_P10 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 29)",
        "    #define FXAA_QUALITY_PS 12",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 2.0",
        "    #define FXAA_QUALITY_P6 2.0",
        "    #define FXAA_QUALITY_P7 2.0",
        "    #define FXAA_QUALITY_P8 2.0",
        "    #define FXAA_QUALITY_P9 2.0",
        "    #define FXAA_QUALITY_P10 4.0",
        "    #define FXAA_QUALITY_P11 8.0",
        "#endif",
        "",
        "/*============================================================================",
        "                     FXAA QUALITY - EXTREME QUALITY",
        "============================================================================*/",
        "#if (FXAA_QUALITY_PRESET == 39)",
        "    #define FXAA_QUALITY_PS 12",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.0",
        "    #define FXAA_QUALITY_P2 1.0",
        "    #define FXAA_QUALITY_P3 1.0",
        "    #define FXAA_QUALITY_P4 1.0",
        "    #define FXAA_QUALITY_P5 1.5",
        "    #define FXAA_QUALITY_P6 2.0",
        "    #define FXAA_QUALITY_P7 2.0",
        "    #define FXAA_QUALITY_P8 2.0",
        "    #define FXAA_QUALITY_P9 2.0",
        "    #define FXAA_QUALITY_P10 4.0",
        "    #define FXAA_QUALITY_P11 8.0",
        "#endif",
        "",
        "",
        "",
        "/*============================================================================",
        "",
        "                                API PORTING",
        "",
        "============================================================================*/",
        "#if (FXAA_GLSL_100 == 1) || (FXAA_GLSL_120 == 1) || (FXAA_GLSL_130 == 1)",
        "    #define FxaaBool bool",
        "    #define FxaaDiscard discard",
        "    #define FxaaFloat float",
        "    #define FxaaFloat2 vec2",
        "    #define FxaaFloat3 vec3",
        "    #define FxaaFloat4 vec4",
        "    #define FxaaHalf float",
        "    #define FxaaHalf2 vec2",
        "    #define FxaaHalf3 vec3",
        "    #define FxaaHalf4 vec4",
        "    #define FxaaInt2 ivec2",
        "    #define FxaaSat(x) clamp(x, 0.0, 1.0)",
        "    #define FxaaTex sampler2D",
        "#else",
        "    #define FxaaBool bool",
        "    #define FxaaDiscard clip(-1)",
        "    #define FxaaFloat float",
        "    #define FxaaFloat2 float2",
        "    #define FxaaFloat3 float3",
        "    #define FxaaFloat4 float4",
        "    #define FxaaHalf half",
        "    #define FxaaHalf2 half2",
        "    #define FxaaHalf3 half3",
        "    #define FxaaHalf4 half4",
        "    #define FxaaSat(x) saturate(x)",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_GLSL_100 == 1)",
        "  #define FxaaTexTop(t, p) texture2D(t, p, 0.0)",
        "  #define FxaaTexOff(t, p, o, r) texture2D(t, p + (o * r), 0.0)",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_GLSL_120 == 1)",
        "    // Requires,",
        "    //  #version 120",
        "    // And at least,",
        "    //  #extension GL_EXT_gpu_shader4 : enable",
        "    //  (or set FXAA_FAST_PIXEL_OFFSET 1 to work like DX9)",
        "    #define FxaaTexTop(t, p) texture2DLod(t, p, 0.0)",
        "    #if (FXAA_FAST_PIXEL_OFFSET == 1)",
        "        #define FxaaTexOff(t, p, o, r) texture2DLodOffset(t, p, 0.0, o)",
        "    #else",
        "        #define FxaaTexOff(t, p, o, r) texture2DLod(t, p + (o * r), 0.0)",
        "    #endif",
        "    #if (FXAA_GATHER4_ALPHA == 1)",
        "        // use #extension GL_ARB_gpu_shader5 : enable",
        "        #define FxaaTexAlpha4(t, p) textureGather(t, p, 3)",
        "        #define FxaaTexOffAlpha4(t, p, o) textureGatherOffset(t, p, o, 3)",
        "        #define FxaaTexGreen4(t, p) textureGather(t, p, 1)",
        "        #define FxaaTexOffGreen4(t, p, o) textureGatherOffset(t, p, o, 1)",
        "    #endif",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_GLSL_130 == 1)",
        "    // Requires \"#version 130\" or better",
        "    #define FxaaTexTop(t, p) textureLod(t, p, 0.0)",
        "    #define FxaaTexOff(t, p, o, r) textureLodOffset(t, p, 0.0, o)",
        "    #if (FXAA_GATHER4_ALPHA == 1)",
        "        // use #extension GL_ARB_gpu_shader5 : enable",
        "        #define FxaaTexAlpha4(t, p) textureGather(t, p, 3)",
        "        #define FxaaTexOffAlpha4(t, p, o) textureGatherOffset(t, p, o, 3)",
        "        #define FxaaTexGreen4(t, p) textureGather(t, p, 1)",
        "        #define FxaaTexOffGreen4(t, p, o) textureGatherOffset(t, p, o, 1)",
        "    #endif",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_HLSL_3 == 1)",
        "    #define FxaaInt2 float2",
        "    #define FxaaTex sampler2D",
        "    #define FxaaTexTop(t, p) tex2Dlod(t, float4(p, 0.0, 0.0))",
        "    #define FxaaTexOff(t, p, o, r) tex2Dlod(t, float4(p + (o * r), 0, 0))",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_HLSL_4 == 1)",
        "    #define FxaaInt2 int2",
        "    struct FxaaTex { SamplerState smpl; Texture2D tex; };",
        "    #define FxaaTexTop(t, p) t.tex.SampleLevel(t.smpl, p, 0.0)",
        "    #define FxaaTexOff(t, p, o, r) t.tex.SampleLevel(t.smpl, p, 0.0, o)",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_HLSL_5 == 1)",
        "    #define FxaaInt2 int2",
        "    struct FxaaTex { SamplerState smpl; Texture2D tex; };",
        "    #define FxaaTexTop(t, p) t.tex.SampleLevel(t.smpl, p, 0.0)",
        "    #define FxaaTexOff(t, p, o, r) t.tex.SampleLevel(t.smpl, p, 0.0, o)",
        "    #define FxaaTexAlpha4(t, p) t.tex.GatherAlpha(t.smpl, p)",
        "    #define FxaaTexOffAlpha4(t, p, o) t.tex.GatherAlpha(t.smpl, p, o)",
        "    #define FxaaTexGreen4(t, p) t.tex.GatherGreen(t.smpl, p)",
        "    #define FxaaTexOffGreen4(t, p, o) t.tex.GatherGreen(t.smpl, p, o)",
        "#endif",
        "",
        "",
        "/*============================================================================",
        "                   GREEN AS LUMA OPTION SUPPORT FUNCTION",
        "============================================================================*/",
        "#if (FXAA_GREEN_AS_LUMA == 0)",
        "    FxaaFloat FxaaLuma(FxaaFloat4 rgba) { return rgba.w; }",
        "#else",
        "    FxaaFloat FxaaLuma(FxaaFloat4 rgba) { return rgba.y; }",
        "#endif",
        "",
        "",
        "",
        "",
        "/*============================================================================",
        "",
        "                             FXAA3 QUALITY - PC",
        "",
        "============================================================================*/",
        "#if (FXAA_PC == 1)",
        "/*--------------------------------------------------------------------------*/",
        "FxaaFloat4 FxaaPixelShader(",
        "    //",
        "    // Use noperspective interpolation here (turn off perspective interpolation).",
        "    // {xy} = center of pixel",
        "    FxaaFloat2 pos,",
        "    //",
        "    // Used only for FXAA Console, and not used on the 360 version.",
        "    // Use noperspective interpolation here (turn off perspective interpolation).",
        "    // {xy_} = upper left of pixel",
        "    // {_zw} = lower right of pixel",
        "    FxaaFloat4 fxaaConsolePosPos,",
        "    //",
        "    // Input color texture.",
        "    // {rgb_} = color in linear or perceptual color space",
        "    // if (FXAA_GREEN_AS_LUMA == 0)",
        "    //     {__a} = luma in perceptual color space (not linear)",
        "    FxaaTex tex,",
        "    //",
        "    // Only used on the optimized 360 version of FXAA Console.",
        "    // For everything but 360, just use the same input here as for \"tex\".",
        "    // For 360, same texture, just alias with a 2nd sampler.",
        "    // This sampler needs to have an exponent bias of -1.",
        "    FxaaTex fxaaConsole360TexExpBiasNegOne,",
        "    //",
        "    // Only used on the optimized 360 version of FXAA Console.",
        "    // For everything but 360, just use the same input here as for \"tex\".",
        "    // For 360, same texture, just alias with a 3nd sampler.",
        "    // This sampler needs to have an exponent bias of -2.",
        "    FxaaTex fxaaConsole360TexExpBiasNegTwo,",
        "    //",
        "    // Only used on FXAA Quality.",
        "    // This must be from a constant/uniform.",
        "    // {x_} = 1.0/screenWidthInPixels",
        "    // {_y} = 1.0/screenHeightInPixels",
        "    FxaaFloat2 fxaaQualityRcpFrame,",
        "    //",
        "    // Only used on FXAA Console.",
        "    // This must be from a constant/uniform.",
        "    // This effects sub-pixel AA quality and inversely sharpness.",
        "    //   Where N ranges between,",
        "    //     N = 0.50 (default)",
        "    //     N = 0.33 (sharper)",
        "    // {x__} = -N/screenWidthInPixels",
        "    // {_y_} = -N/screenHeightInPixels",
        "    // {_z_} =  N/screenWidthInPixels",
        "    // {__w} =  N/screenHeightInPixels",
        "    FxaaFloat4 fxaaConsoleRcpFrameOpt,",
        "    //",
        "    // Only used on FXAA Console.",
        "    // Not used on 360, but used on PS3 and PC.",
        "    // This must be from a constant/uniform.",
        "    // {x__} = -2.0/screenWidthInPixels",
        "    // {_y_} = -2.0/screenHeightInPixels",
        "    // {_z_} =  2.0/screenWidthInPixels",
        "    // {__w} =  2.0/screenHeightInPixels",
        "    FxaaFloat4 fxaaConsoleRcpFrameOpt2,",
        "    //",
        "    // Only used on FXAA Console.",
        "    // Only used on 360 in place of fxaaConsoleRcpFrameOpt2.",
        "    // This must be from a constant/uniform.",
        "    // {x__} =  8.0/screenWidthInPixels",
        "    // {_y_} =  8.0/screenHeightInPixels",
        "    // {_z_} = -4.0/screenWidthInPixels",
        "    // {__w} = -4.0/screenHeightInPixels",
        "    FxaaFloat4 fxaaConsole360RcpFrameOpt2,",
        "    //",
        "    // Only used on FXAA Quality.",
        "    // This used to be the FXAA_QUALITY_SUBPIX define.",
        "    // It is here now to allow easier tuning.",
        "    // Choose the amount of sub-pixel aliasing removal.",
        "    // This can effect sharpness.",
        "    //   1.00 - upper limit (softer)",
        "    //   0.75 - default amount of filtering",
        "    //   0.50 - lower limit (sharper, less sub-pixel aliasing removal)",
        "    //   0.25 - almost off",
        "    //   0.00 - completely off",
        "    FxaaFloat fxaaQualitySubpix,",
        "    //",
        "    // Only used on FXAA Quality.",
        "    // This used to be the FXAA_QUALITY_EDGE_THRESHOLD define.",
        "    // It is here now to allow easier tuning.",
        "    // The minimum amount of local contrast required to apply algorithm.",
        "    //   0.333 - too little (faster)",
        "    //   0.250 - low quality",
        "    //   0.166 - default",
        "    //   0.125 - high quality",
        "    //   0.063 - overkill (slower)",
        "    FxaaFloat fxaaQualityEdgeThreshold,",
        "    //",
        "    // Only used on FXAA Quality.",
        "    // This used to be the FXAA_QUALITY_EDGE_THRESHOLD_MIN define.",
        "    // It is here now to allow easier tuning.",
        "    // Trims the algorithm from processing darks.",
        "    //   0.0833 - upper limit (default, the start of visible unfiltered edges)",
        "    //   0.0625 - high quality (faster)",
        "    //   0.0312 - visible limit (slower)",
        "    // Special notes when using FXAA_GREEN_AS_LUMA,",
        "    //   Likely want to set this to zero.",
        "    //   As colors that are mostly not-green",
        "    //   will appear very dark in the green channel!",
        "    //   Tune by looking at mostly non-green content,",
        "    //   then start at zero and increase until aliasing is a problem.",
        "    FxaaFloat fxaaQualityEdgeThresholdMin,",
        "    //",
        "    // Only used on FXAA Console.",
        "    // This used to be the FXAA_CONSOLE_EDGE_SHARPNESS define.",
        "    // It is here now to allow easier tuning.",
        "    // This does not effect PS3, as this needs to be compiled in.",
        "    //   Use FXAA_CONSOLE_PS3_EDGE_SHARPNESS for PS3.",
        "    //   Due to the PS3 being ALU bound,",
        "    //   there are only three safe values here: 2 and 4 and 8.",
        "    //   These options use the shaders ability to a free *|/ by 2|4|8.",
        "    // For all other platforms can be a non-power of two.",
        "    //   8.0 is sharper (default!!!)",
        "    //   4.0 is softer",
        "    //   2.0 is really soft (good only for vector graphics inputs)",
        "    FxaaFloat fxaaConsoleEdgeSharpness,",
        "    //",
        "    // Only used on FXAA Console.",
        "    // This used to be the FXAA_CONSOLE_EDGE_THRESHOLD define.",
        "    // It is here now to allow easier tuning.",
        "    // This does not effect PS3, as this needs to be compiled in.",
        "    //   Use FXAA_CONSOLE_PS3_EDGE_THRESHOLD for PS3.",
        "    //   Due to the PS3 being ALU bound,",
        "    //   there are only two safe values here: 1/4 and 1/8.",
        "    //   These options use the shaders ability to a free *|/ by 2|4|8.",
        "    // The console setting has a different mapping than the quality setting.",
        "    // Other platforms can use other values.",
        "    //   0.125 leaves less aliasing, but is softer (default!!!)",
        "    //   0.25 leaves more aliasing, and is sharper",
        "    FxaaFloat fxaaConsoleEdgeThreshold,",
        "    //",
        "    // Only used on FXAA Console.",
        "    // This used to be the FXAA_CONSOLE_EDGE_THRESHOLD_MIN define.",
        "    // It is here now to allow easier tuning.",
        "    // Trims the algorithm from processing darks.",
        "    // The console setting has a different mapping than the quality setting.",
        "    // This only applies when FXAA_EARLY_EXIT is 1.",
        "    // This does not apply to PS3,",
        "    // PS3 was simplified to avoid more shader instructions.",
        "    //   0.06 - faster but more aliasing in darks",
        "    //   0.05 - default",
        "    //   0.04 - slower and less aliasing in darks",
        "    // Special notes when using FXAA_GREEN_AS_LUMA,",
        "    //   Likely want to set this to zero.",
        "    //   As colors that are mostly not-green",
        "    //   will appear very dark in the green channel!",
        "    //   Tune by looking at mostly non-green content,",
        "    //   then start at zero and increase until aliasing is a problem.",
        "    FxaaFloat fxaaConsoleEdgeThresholdMin,",
        "    //",
        "    // Extra constants for 360 FXAA Console only.",
        "    // Use zeros or anything else for other platforms.",
        "    // These must be in physical constant registers and NOT immediates.",
        "    // Immediates will result in compiler un-optimizing.",
        "    // {xyzw} = float4(1.0, -1.0, 0.25, -0.25)",
        "    FxaaFloat4 fxaaConsole360ConstDir",
        ") {",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat2 posM;",
        "    posM.x = pos.x;",
        "    posM.y = pos.y;",
        "    #if (FXAA_GATHER4_ALPHA == 1)",
        "        #if (FXAA_DISCARD == 0)",
        "            FxaaFloat4 rgbyM = FxaaTexTop(tex, posM);",
        "            #if (FXAA_GREEN_AS_LUMA == 0)",
        "                #define lumaM rgbyM.w",
        "            #else",
        "                #define lumaM rgbyM.y",
        "            #endif",
        "        #endif",
        "        #if (FXAA_GREEN_AS_LUMA == 0)",
        "            FxaaFloat4 luma4A = FxaaTexAlpha4(tex, posM);",
        "            FxaaFloat4 luma4B = FxaaTexOffAlpha4(tex, posM, FxaaInt2(-1, -1));",
        "        #else",
        "            FxaaFloat4 luma4A = FxaaTexGreen4(tex, posM);",
        "            FxaaFloat4 luma4B = FxaaTexOffGreen4(tex, posM, FxaaInt2(-1, -1));",
        "        #endif",
        "        #if (FXAA_DISCARD == 1)",
        "            #define lumaM luma4A.w",
        "        #endif",
        "        #define lumaE luma4A.z",
        "        #define lumaS luma4A.x",
        "        #define lumaSE luma4A.y",
        "        #define lumaNW luma4B.w",
        "        #define lumaN luma4B.z",
        "        #define lumaW luma4B.x",
        "    #else",
        "        FxaaFloat4 rgbyM = FxaaTexTop(tex, posM);",
        "        #if (FXAA_GREEN_AS_LUMA == 0)",
        "            #define lumaM rgbyM.w",
        "        #else",
        "            #define lumaM rgbyM.y",
        "        #endif",
        "        #if (FXAA_GLSL_100 == 1)",
        "          FxaaFloat lumaS = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 0.0, 1.0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0, 0.0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaN = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 0.0,-1.0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0, 0.0), fxaaQualityRcpFrame.xy));",
        "        #else",
        "          FxaaFloat lumaS = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 0, 1), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1, 0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaN = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 0,-1), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 0), fxaaQualityRcpFrame.xy));",
        "        #endif",
        "    #endif",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat maxSM = max(lumaS, lumaM);",
        "    FxaaFloat minSM = min(lumaS, lumaM);",
        "    FxaaFloat maxESM = max(lumaE, maxSM);",
        "    FxaaFloat minESM = min(lumaE, minSM);",
        "    FxaaFloat maxWN = max(lumaN, lumaW);",
        "    FxaaFloat minWN = min(lumaN, lumaW);",
        "    FxaaFloat rangeMax = max(maxWN, maxESM);",
        "    FxaaFloat rangeMin = min(minWN, minESM);",
        "    FxaaFloat rangeMaxScaled = rangeMax * fxaaQualityEdgeThreshold;",
        "    FxaaFloat range = rangeMax - rangeMin;",
        "    FxaaFloat rangeMaxClamped = max(fxaaQualityEdgeThresholdMin, rangeMaxScaled);",
        "    FxaaBool earlyExit = range < rangeMaxClamped;",
        "/*--------------------------------------------------------------------------*/",
        "    if(earlyExit)",
        "        #if (FXAA_DISCARD == 1)",
        "            FxaaDiscard;",
        "        #else",
        "            return rgbyM;",
        "        #endif",
        "/*--------------------------------------------------------------------------*/",
        "    #if (FXAA_GATHER4_ALPHA == 0)",
        "        #if (FXAA_GLSL_100 == 1)",
        "          FxaaFloat lumaNW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0,-1.0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaSE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0, 1.0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0,-1.0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0, 1.0), fxaaQualityRcpFrame.xy));",
        "        #else",
        "          FxaaFloat lumaNW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1,-1), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaSE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1, 1), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1,-1), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 1), fxaaQualityRcpFrame.xy));",
        "        #endif",
        "    #else",
        "        FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(1, -1), fxaaQualityRcpFrame.xy));",
        "        FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 1), fxaaQualityRcpFrame.xy));",
        "    #endif",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat lumaNS = lumaN + lumaS;",
        "    FxaaFloat lumaWE = lumaW + lumaE;",
        "    FxaaFloat subpixRcpRange = 1.0/range;",
        "    FxaaFloat subpixNSWE = lumaNS + lumaWE;",
        "    FxaaFloat edgeHorz1 = (-2.0 * lumaM) + lumaNS;",
        "    FxaaFloat edgeVert1 = (-2.0 * lumaM) + lumaWE;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat lumaNESE = lumaNE + lumaSE;",
        "    FxaaFloat lumaNWNE = lumaNW + lumaNE;",
        "    FxaaFloat edgeHorz2 = (-2.0 * lumaE) + lumaNESE;",
        "    FxaaFloat edgeVert2 = (-2.0 * lumaN) + lumaNWNE;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat lumaNWSW = lumaNW + lumaSW;",
        "    FxaaFloat lumaSWSE = lumaSW + lumaSE;",
        "    FxaaFloat edgeHorz4 = (abs(edgeHorz1) * 2.0) + abs(edgeHorz2);",
        "    FxaaFloat edgeVert4 = (abs(edgeVert1) * 2.0) + abs(edgeVert2);",
        "    FxaaFloat edgeHorz3 = (-2.0 * lumaW) + lumaNWSW;",
        "    FxaaFloat edgeVert3 = (-2.0 * lumaS) + lumaSWSE;",
        "    FxaaFloat edgeHorz = abs(edgeHorz3) + edgeHorz4;",
        "    FxaaFloat edgeVert = abs(edgeVert3) + edgeVert4;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat subpixNWSWNESE = lumaNWSW + lumaNESE;",
        "    FxaaFloat lengthSign = fxaaQualityRcpFrame.x;",
        "    FxaaBool horzSpan = edgeHorz >= edgeVert;",
        "    FxaaFloat subpixA = subpixNSWE * 2.0 + subpixNWSWNESE;",
        "/*--------------------------------------------------------------------------*/",
        "    if(!horzSpan) lumaN = lumaW;",
        "    if(!horzSpan) lumaS = lumaE;",
        "    if(horzSpan) lengthSign = fxaaQualityRcpFrame.y;",
        "    FxaaFloat subpixB = (subpixA * (1.0/12.0)) - lumaM;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat gradientN = lumaN - lumaM;",
        "    FxaaFloat gradientS = lumaS - lumaM;",
        "    FxaaFloat lumaNN = lumaN + lumaM;",
        "    FxaaFloat lumaSS = lumaS + lumaM;",
        "    FxaaBool pairN = abs(gradientN) >= abs(gradientS);",
        "    FxaaFloat gradient = max(abs(gradientN), abs(gradientS));",
        "    if(pairN) lengthSign = -lengthSign;",
        "    FxaaFloat subpixC = FxaaSat(abs(subpixB) * subpixRcpRange);",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat2 posB;",
        "    posB.x = posM.x;",
        "    posB.y = posM.y;",
        "    FxaaFloat2 offNP;",
        "    offNP.x = (!horzSpan) ? 0.0 : fxaaQualityRcpFrame.x;",
        "    offNP.y = ( horzSpan) ? 0.0 : fxaaQualityRcpFrame.y;",
        "    if(!horzSpan) posB.x += lengthSign * 0.5;",
        "    if( horzSpan) posB.y += lengthSign * 0.5;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat2 posN;",
        "    posN.x = posB.x - offNP.x * FXAA_QUALITY_P0;",
        "    posN.y = posB.y - offNP.y * FXAA_QUALITY_P0;",
        "    FxaaFloat2 posP;",
        "    posP.x = posB.x + offNP.x * FXAA_QUALITY_P0;",
        "    posP.y = posB.y + offNP.y * FXAA_QUALITY_P0;",
        "    FxaaFloat subpixD = ((-2.0)*subpixC) + 3.0;",
        "    FxaaFloat lumaEndN = FxaaLuma(FxaaTexTop(tex, posN));",
        "    FxaaFloat subpixE = subpixC * subpixC;",
        "    FxaaFloat lumaEndP = FxaaLuma(FxaaTexTop(tex, posP));",
        "/*--------------------------------------------------------------------------*/",
        "    if(!pairN) lumaNN = lumaSS;",
        "    FxaaFloat gradientScaled = gradient * 1.0/4.0;",
        "    FxaaFloat lumaMM = lumaM - lumaNN * 0.5;",
        "    FxaaFloat subpixF = subpixD * subpixE;",
        "    FxaaBool lumaMLTZero = lumaMM < 0.0;",
        "/*--------------------------------------------------------------------------*/",
        "    lumaEndN -= lumaNN * 0.5;",
        "    lumaEndP -= lumaNN * 0.5;",
        "    FxaaBool doneN = abs(lumaEndN) >= gradientScaled;",
        "    FxaaBool doneP = abs(lumaEndP) >= gradientScaled;",
        "    if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P1;",
        "    if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P1;",
        "    FxaaBool doneNP = (!doneN) || (!doneP);",
        "    if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P1;",
        "    if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P1;",
        "/*--------------------------------------------------------------------------*/",
        "    if(doneNP) {",
        "        if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "        if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "        if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "        if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "        doneN = abs(lumaEndN) >= gradientScaled;",
        "        doneP = abs(lumaEndP) >= gradientScaled;",
        "        if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P2;",
        "        if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P2;",
        "        doneNP = (!doneN) || (!doneP);",
        "        if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P2;",
        "        if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P2;",
        "/*--------------------------------------------------------------------------*/",
        "        #if (FXAA_QUALITY_PS > 3)",
        "        if(doneNP) {",
        "            if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "            if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "            if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "            if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "            doneN = abs(lumaEndN) >= gradientScaled;",
        "            doneP = abs(lumaEndP) >= gradientScaled;",
        "            if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P3;",
        "            if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P3;",
        "            doneNP = (!doneN) || (!doneP);",
        "            if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P3;",
        "            if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P3;",
        "/*--------------------------------------------------------------------------*/",
        "            #if (FXAA_QUALITY_PS > 4)",
        "            if(doneNP) {",
        "                if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                doneN = abs(lumaEndN) >= gradientScaled;",
        "                doneP = abs(lumaEndP) >= gradientScaled;",
        "                if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P4;",
        "                if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P4;",
        "                doneNP = (!doneN) || (!doneP);",
        "                if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P4;",
        "                if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P4;",
        "/*--------------------------------------------------------------------------*/",
        "                #if (FXAA_QUALITY_PS > 5)",
        "                if(doneNP) {",
        "                    if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                    if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                    if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                    if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                    doneN = abs(lumaEndN) >= gradientScaled;",
        "                    doneP = abs(lumaEndP) >= gradientScaled;",
        "                    if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P5;",
        "                    if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P5;",
        "                    doneNP = (!doneN) || (!doneP);",
        "                    if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P5;",
        "                    if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P5;",
        "/*--------------------------------------------------------------------------*/",
        "                    #if (FXAA_QUALITY_PS > 6)",
        "                    if(doneNP) {",
        "                        if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                        if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                        if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                        if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                        doneN = abs(lumaEndN) >= gradientScaled;",
        "                        doneP = abs(lumaEndP) >= gradientScaled;",
        "                        if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P6;",
        "                        if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P6;",
        "                        doneNP = (!doneN) || (!doneP);",
        "                        if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P6;",
        "                        if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P6;",
        "/*--------------------------------------------------------------------------*/",
        "                        #if (FXAA_QUALITY_PS > 7)",
        "                        if(doneNP) {",
        "                            if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                            if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                            if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                            if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                            doneN = abs(lumaEndN) >= gradientScaled;",
        "                            doneP = abs(lumaEndP) >= gradientScaled;",
        "                            if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P7;",
        "                            if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P7;",
        "                            doneNP = (!doneN) || (!doneP);",
        "                            if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P7;",
        "                            if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P7;",
        "/*--------------------------------------------------------------------------*/",
        "    #if (FXAA_QUALITY_PS > 8)",
        "    if(doneNP) {",
        "        if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "        if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "        if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "        if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "        doneN = abs(lumaEndN) >= gradientScaled;",
        "        doneP = abs(lumaEndP) >= gradientScaled;",
        "        if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P8;",
        "        if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P8;",
        "        doneNP = (!doneN) || (!doneP);",
        "        if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P8;",
        "        if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P8;",
        "/*--------------------------------------------------------------------------*/",
        "        #if (FXAA_QUALITY_PS > 9)",
        "        if(doneNP) {",
        "            if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "            if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "            if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "            if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "            doneN = abs(lumaEndN) >= gradientScaled;",
        "            doneP = abs(lumaEndP) >= gradientScaled;",
        "            if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P9;",
        "            if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P9;",
        "            doneNP = (!doneN) || (!doneP);",
        "            if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P9;",
        "            if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P9;",
        "/*--------------------------------------------------------------------------*/",
        "            #if (FXAA_QUALITY_PS > 10)",
        "            if(doneNP) {",
        "                if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                doneN = abs(lumaEndN) >= gradientScaled;",
        "                doneP = abs(lumaEndP) >= gradientScaled;",
        "                if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P10;",
        "                if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P10;",
        "                doneNP = (!doneN) || (!doneP);",
        "                if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P10;",
        "                if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P10;",
        "/*--------------------------------------------------------------------------*/",
        "                #if (FXAA_QUALITY_PS > 11)",
        "                if(doneNP) {",
        "                    if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                    if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                    if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                    if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                    doneN = abs(lumaEndN) >= gradientScaled;",
        "                    doneP = abs(lumaEndP) >= gradientScaled;",
        "                    if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P11;",
        "                    if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P11;",
        "                    doneNP = (!doneN) || (!doneP);",
        "                    if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P11;",
        "                    if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P11;",
        "/*--------------------------------------------------------------------------*/",
        "                    #if (FXAA_QUALITY_PS > 12)",
        "                    if(doneNP) {",
        "                        if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                        if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                        if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                        if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                        doneN = abs(lumaEndN) >= gradientScaled;",
        "                        doneP = abs(lumaEndP) >= gradientScaled;",
        "                        if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P12;",
        "                        if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P12;",
        "                        doneNP = (!doneN) || (!doneP);",
        "                        if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P12;",
        "                        if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P12;",
        "/*--------------------------------------------------------------------------*/",
        "                    }",
        "                    #endif",
        "/*--------------------------------------------------------------------------*/",
        "                }",
        "                #endif",
        "/*--------------------------------------------------------------------------*/",
        "            }",
        "            #endif",
        "/*--------------------------------------------------------------------------*/",
        "        }",
        "        #endif",
        "/*--------------------------------------------------------------------------*/",
        "    }",
        "    #endif",
        "/*--------------------------------------------------------------------------*/",
        "                        }",
        "                        #endif",
        "/*--------------------------------------------------------------------------*/",
        "                    }",
        "                    #endif",
        "/*--------------------------------------------------------------------------*/",
        "                }",
        "                #endif",
        "/*--------------------------------------------------------------------------*/",
        "            }",
        "            #endif",
        "/*--------------------------------------------------------------------------*/",
        "        }",
        "        #endif",
        "/*--------------------------------------------------------------------------*/",
        "    }",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat dstN = posM.x - posN.x;",
        "    FxaaFloat dstP = posP.x - posM.x;",
        "    if(!horzSpan) dstN = posM.y - posN.y;",
        "    if(!horzSpan) dstP = posP.y - posM.y;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaBool goodSpanN = (lumaEndN < 0.0) != lumaMLTZero;",
        "    FxaaFloat spanLength = (dstP + dstN);",
        "    FxaaBool goodSpanP = (lumaEndP < 0.0) != lumaMLTZero;",
        "    FxaaFloat spanLengthRcp = 1.0/spanLength;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaBool directionN = dstN < dstP;",
        "    FxaaFloat dst = min(dstN, dstP);",
        "    FxaaBool goodSpan = directionN ? goodSpanN : goodSpanP;",
        "    FxaaFloat subpixG = subpixF * subpixF;",
        "    FxaaFloat pixelOffset = (dst * (-spanLengthRcp)) + 0.5;",
        "    FxaaFloat subpixH = subpixG * fxaaQualitySubpix;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat pixelOffsetGood = goodSpan ? pixelOffset : 0.0;",
        "    FxaaFloat pixelOffsetSubpix = max(pixelOffsetGood, subpixH);",
        "    if(!horzSpan) posM.x += pixelOffsetSubpix * lengthSign;",
        "    if( horzSpan) posM.y += pixelOffsetSubpix * lengthSign;",
        "    #if (FXAA_DISCARD == 1)",
        "        return FxaaTexTop(tex, posM);",
        "    #else",
        "        return FxaaFloat4(FxaaTexTop(tex, posM).xyz, lumaM);",
        "    #endif",
        "}",
        "/*==========================================================================*/",
        "#endif",
        "",
        "void main() {",
        "  gl_FragColor = FxaaPixelShader(",
        "    vUv,",
        "    vec4(0.0),",
        "    tDiffuse,",
        "    tDiffuse,",
        "    tDiffuse,",
        "    resolution,",
        "    vec4(0.0),",
        "    vec4(0.0),",
        "    vec4(0.0),",
        "    0.75,",
        "    0.166,",
        "    0.0833,",
        "    0.0,",
        "    0.0,",
        "    0.0,",
        "    vec4(0.0)",
        "  );",
        "",
        "  // TODO avoid querying texture twice for same texel",
        "  gl_FragColor.a = texture2D(tDiffuse, vUv).a;",
        "}"
	].join("\n")

};
/**
 * @author WestLangley / http://github.com/WestLangley
 *
 * Gamma Correction Shader
 * http://en.wikipedia.org/wiki/gamma_correction
 */

THREE.GammaCorrectionShader = {

	uniforms: {

		"tDiffuse": { value: null }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

		"	vUv = uv;",
		"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform sampler2D tDiffuse;",

		"varying vec2 vUv;",

		"void main() {",

		"	vec4 tex = texture2D( tDiffuse, vec2( vUv.x, vUv.y ) );",

		"	gl_FragColor = LinearToGamma( tex, float( GAMMA_FACTOR ) );",

		"}"

	].join( "\n" )

};
/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Luminosity
 * http://en.wikipedia.org/wiki/Luminosity
 */

THREE.LuminosityShader = {

	uniforms: {

		"tDiffuse": { value: null }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

		"	vUv = uv;",

		"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"#include <common>",

		"uniform sampler2D tDiffuse;",

		"varying vec2 vUv;",

		"void main() {",

		"	vec4 texel = texture2D( tDiffuse, vUv );",

		"	float l = linearToRelativeLuminance( texel.rgb );",

		"	gl_FragColor = vec4( l, l, l, texel.w );",

		"}"

	].join( "\n" )

};
/**
 * @author miibond
 *
 * Full-screen tone-mapping shader based on http://www.cis.rit.edu/people/faculty/ferwerda/publications/sig02_paper.pdf
 */

THREE.ToneMapShader = {

	uniforms: {

		"tDiffuse": { value: null },
		"averageLuminance": { value: 1.0 },
		"luminanceMap": { value: null },
		"maxLuminance": { value: 16.0 },
		"minLuminance": { value: 0.01 },
		"middleGrey": { value: 0.6 }
	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

		"	vUv = uv;",
		"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"#include <common>",

		"uniform sampler2D tDiffuse;",

		"varying vec2 vUv;",

		"uniform float middleGrey;",
		"uniform float minLuminance;",
		"uniform float maxLuminance;",
		"#ifdef ADAPTED_LUMINANCE",
		"	uniform sampler2D luminanceMap;",
		"#else",
		"	uniform float averageLuminance;",
		"#endif",

		"vec3 ToneMap( vec3 vColor ) {",
		"	#ifdef ADAPTED_LUMINANCE",
		// Get the calculated average luminance
		"		float fLumAvg = texture2D(luminanceMap, vec2(0.5, 0.5)).r;",
		"	#else",
		"		float fLumAvg = averageLuminance;",
		"	#endif",

		// Calculate the luminance of the current pixel
		"	float fLumPixel = linearToRelativeLuminance( vColor );",

		// Apply the modified operator (Eq. 4)
		"	float fLumScaled = (fLumPixel * middleGrey) / max( minLuminance, fLumAvg );",

		"	float fLumCompressed = (fLumScaled * (1.0 + (fLumScaled / (maxLuminance * maxLuminance)))) / (1.0 + fLumScaled);",
		"	return fLumCompressed * vColor;",
		"}",

		"void main() {",

		"	vec4 texel = texture2D( tDiffuse, vUv );",

		"	gl_FragColor = vec4( ToneMap( texel.xyz ), texel.w );",

		"}"

	].join( "\n" )

};
/**
 * @author bhouston / http://clara.io/
 *
 * Luminosity
 * http://en.wikipedia.org/wiki/Luminosity
 */

THREE.LuminosityHighPassShader = {

	shaderID: "luminosityHighPass",

	uniforms: {

		"tDiffuse": { value: null },
		"luminosityThreshold": { value: 1.0 },
		"smoothWidth": { value: 1.0 },
		"defaultColor": { value: new THREE.Color( 0x000000 ) },
		"defaultOpacity": { value: 0.0 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

		"	vUv = uv;",

		"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform sampler2D tDiffuse;",
		"uniform vec3 defaultColor;",
		"uniform float defaultOpacity;",
		"uniform float luminosityThreshold;",
		"uniform float smoothWidth;",

		"varying vec2 vUv;",

		"void main() {",

		"	vec4 texel = texture2D( tDiffuse, vUv );",

		"	vec3 luma = vec3( 0.299, 0.587, 0.114 );",

		"	float v = dot( texel.xyz, luma );",

		"	vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );",

		"	float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );",

		"	gl_FragColor = mix( outputColor, texel, alpha );",

		"}"

	].join( "\n" )

};
