'use strict';

const HELPER_BASE = process.env.HELPER_BASE || '../../helpers/';
const BinResponse = require(HELPER_BASE + 'binresponse');

const { URLSearchParams } = require('url');
const fetch = require('node-fetch');

const genchart = require('./genchart');
const ping = require('ping');
const osu = require('node-os-utils');

const PING_TIMEOUT = 3;

const netdata_base_url = "【netdataのURL】";

exports.handler = async (event, context, callback) => {

	if( event.path == '/makechart-inspect' ){
		console.log(event.queryStringParameters);

		if (event.queryStringParameters.type == 'netdata' ){
			const width = event.queryStringParameters.width ? Number(event.queryStringParameters.width) : 640;
			const height = event.queryStringParameters.height ? Number(event.queryStringParameters.height) : 480;
			const chart = event.queryStringParameters.chart || 'system.cpu';

			var qs = {
				chart: chart,
				points: 20,
				format: 'json',
				after: -600,
				group: 'max',
				options: 'jsonwrap'
			};
			var json = await do_get(netdata_base_url + '/api/v1/data', qs);
			console.log(json);

			var labels = [];
			for( var i = 0 ; i < json.points ; i++ ){
//				labels.push(String((qs.after / qs.points) * (json.points - i - 1)) + 's');
				var t = new Date(json.result.data[json.points - i - 1][0] * 1000);
				labels.push(zero2d(t.getHours()) + ':' + zero2d(t.getMinutes()) + ':' + zero2d(t.getSeconds()));
			}
			var datum = [];
			for (var j = 1; j < json.result.labels.length ; j++ ){
				var array = [];
				for (var i = 0; i < json.points; i++) {
					array.push(json.result.data[json.points - i - 1][j]);
				}
				datum.push(array);
			}
			var legends = [];
			for (var i = 1; i < json.result.labels.length ; i++ )
				legends.push(json.result.labels[i]);

			var image_buffer = await genchart.generateChart(width, height, "line", {
				datum: datum,
				labels: labels,
				legends: legends,
				title: 'netdata: ' + chart,
				range: (event.queryStringParameters.max) ? { max: Number(event.queryStringParameters.max) } : undefined
			});

			return new BinResponse("image/png", image_buffer);
		}else
		if( event.queryStringParameters.type == 'ping' ){
			const width = event.queryStringParameters.width ? Number(event.queryStringParameters.width) : 640;
			const height = event.queryStringParameters.height ? Number(event.queryStringParameters.height) : 480;
			const hosts = event.queryStringParameters.hosts.split(',');
			const trycount = event.queryStringParameters.trycount ? Number(event.queryStringParameters.trycount) : 3;

			const promises = hosts.map( async item => {
				var result = {
					success: 0,
					error: 0
				};
				for (var i = 0; i < trycount ; i++ ){
					try{
						var res = await ping.promise.probe(item, {
							timeout: PING_TIMEOUT,
						});
						if( res.alive )
							result.success++;
						else
							result.error++;
					}catch(error){
						console.log(error);
						result.error++;
					}
				}
				return result;
			});

			var result = await Promise.all(promises);

			var datum = result.map(item =>{
				return [ item.success, item.error ];
			});

			var image_buffer = await genchart.generateChart(width, height, "stackbar", {
				datum: datum,
				labels: hosts,
				legends: ["OK", "NG"],
				title: 'Pingライフチェック',
			});

			return new BinResponse("image/png", image_buffer);
		}else
		if (event.queryStringParameters.type == 'memory' ){
			const width = event.queryStringParameters.width ? Number(event.queryStringParameters.width) : 640;
			const height = event.queryStringParameters.height ? Number(event.queryStringParameters.height) : 480;

			var info = await osu.mem.used();
			var used = info.usedMemMb / info.totalMemMb * 100;

			var image_buffer = await genchart.generateChart(width, height, "gauge", {
				value: used,
				title: '使用メモリ(%)',
				range: { min: 0, max: 100 }
			}, used.toFixed(1) + '%');

			return new BinResponse("image/png", image_buffer);
		}

	// var image_buffer = await genchart.generateChart(width, height, "doughnut", {
	// 	value: 10,
	// 	range: { max: 50 },
	// 	legend: 'レジェンド',
	// 	title: 'ドーナツチャート',
	// }, '50点');

	// var image_buffer = await genchart.generateChart(width, height, "gauge", {
	// 	value: 10,
	// 	range: { min: 0, max: 50 },
	// 	legend: 'レジェンド',
	// 	title: 'ゲージチャート',
	// }, '50点');

	// var datum = [
	// 	[880, 740, 900, 520, 930],
	// 	[380, 440, 500, 220, 630],
	// ];
	// var image_buffer = await genchart.generateChart(width, height, "line", {
	// 	datum: datum,
	// 	labels: ["1月", "2月", "3月", "4月", "5月"],
	// 	legends: ['プリンター販売台数', 'パソコン販売台数'],
	// 	range: { min: 0, max: 1000 },
	// 	title: 'ラインチャート',
	// }, '50点');

	// var image_buffer = await genchart.generateChart(width, height, "pie", {
	// 	datum: [880, 740, 100],
	// 	legends: ["OK", "NG", "UNKNOWN"],
	// 	title: 'パイチャート',
	// }, '50点');

	// var datum = [
	// 	[1, 4], [5, 0], [3, 2], [4, 1]
	// ];
	// var image_buffer = await genchart.generateChart(width, height, "stackbar", {
	// 	datum: datum,
	// 	labels: ["pc1", "pc2", "pc3", "pc4"],
	// 	legends: ["OK", "NG"],
	// 	title: 'スタックバーチャート',
	// }, '50点');

	// var image_buffer = await genchart.generateChart(width, height, "bar", {
	// 	datum: [1, 2, 3, 5, 2],
	// 	labels: ["1月", "2月", "3月", "4月", "5月"],
	// 	title: 'バーチャート',
	//  range: { min: 0 },
	// }, '50点');

	} else
	if (event.path == '/makechart-generate') {
		console.log(event.body);
		var body = JSON.parse(event.body);

		var image_buffer = await genchart.generateChart(body.width, body.height, body.type, body.chart_params, body.caption, body.bgcolor);

		return new BinResponse("image/png", image_buffer);
	}
};

function zero2d(val) {
	return ('00' + String(val)).slice(-2);
}

function do_get(url, qs) {
	var params = new URLSearchParams(qs);

	return fetch(url + `?` + params.toString(), {
		method: 'GET',
	})
		.then((response) => {
			if (!response.ok)
				throw 'status is not 200';
			return response.json();
		});
}