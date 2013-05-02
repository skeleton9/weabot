// Weabot is a weather report plugin for Google Chrome
// Designed for Chinese users
// Developed by skeleton9
// See more on my github page

// We use the API of www.weather.com.cn
// There is no offical document from the site
// For many fields I am not so sure about what it means
// And I found some articals that analysed the data formats:
//   http://blog.mynook.info/2012/08/18/weather-com-cn-api.html
//   http://huoxr.com/archives/2734.html
//   http://g.kehou.com/t1033317914.html

// Utility for string format
String.prototype.format = function () {
	var args = arguments;
	return this.replace(/{(\d+)}/g, function (match, number) {
		return typeof args[number] != 'undefined'
		 ? args[number]
		 : match;
	});
};

// Utility functions to Date Object
var WeekDays_cn = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

Date.prototype.toSimpleDateString = function () {
	return this.getFullYear() + "年" + (this.getMonth() + 1) + "月" + this.getDate() + "日";
};

Date.prototype.toMonthDayString = function () {
	return (this.getMonth() + 1) + "月" + this.getDate() + "日";
};

Date.prototype.toDayString = function () {
	return this.getDate() + "日";
};

// Get Chinese week day string
Date.prototype.toWeek_cn = function () {
	return WeekDays_cn[this.getDay()];
};

// Handle wind images
// get wind background images according to wind directions
var Wind = {
	_dict : {
		"东风" : "e",
		"南风" : "s",
		"西风" : "w",
		"北风" : "n",
		"东南风" : "se",
		"西南风" : "sw",
		"东北风" : "ne",
		"西北风" : "nw",
		"default" : "bg_weatherwind"
	},

	_base_url : "http://www.weather.com.cn/m2/i/forecast/",
	_suffix : ".gif",

	getFullUrl : function (wind) {
		if ( Wind._dict[wind] ) {
			return Wind._base_url + Wind._dict[wind] + Wind._suffix;
		} else {
			return Wind._base_url + Wind._dict["default"] + Wind._suffix;
		}
	}
};

// weather iamges
var WeaImg = {
	_image_prefix : "http://www.weather.com.cn/m2/i/icon_weather/29x20/",

	// img index, start from 1
	// return an object of: 
	// {  
	//    src : the image url,
	//    is_day : true/false as the image is for day/night
	// }
	getImageUrl : function (index) {
		var fchh = Weabot._store._data["fchh"] - 0;
		var image_id = Weabot._store._data["img" + index];
		var is_day = true;
		if (fchh < 18 && index % 2 == 0) {
			is_day = false;
		}
		if (fchh >= 18 && index % 2 == 1) {
			is_day = false;
		}
		if ((image_id - 0) < 10) {
			image_id = "0" + image_id;
		}
		if (image_id == "99") {
			image_id = Weabot._store._data["img" + (index - 1)];
		}
		if (is_day == true) {
			image_id = "d" + image_id;
		} else {
			image_id = "n" + image_id;
		}
		return {
			src : this._image_prefix + image_id + ".gif",
			is_day : is_day
		};
	}
};

var Weabot = {
	_fetch_interval : 15 * 60 * 1000, // update interval, 15 min
	_sk_fetch_interval : 5 * 60 * 1000, // real time data update interval, 5 min
	
	_outlink : "http://www.weather.com.cn/weather/{0}.shtml",
	_realtime_url : "http://www.weather.com.cn/data/sk/{0}.html",
	_sixday_url : "http://m.weather.com.cn/data/{0}.html",
	_geo_url : "http://61.4.185.48:81/g/",
	_search_url : "http://toy1.weather.com.cn/search?cityname={0}&callback=data",
	
	_store : {
		_id : null, // city id
		_city : null, // city name

		_data : null, // city weather data for 6 days
		_last_fetch_time : null, //last time to fetch weather data

		_sk_data : null, // city realtime weather data
		_sk_last_fetch_time : null, //last time to fetch realtime weather data
	},

	// store data to chrome.storage.local
	// so next time do not need to fetch data from server if data is not expired
	storeToLocal : function () {
		chrome.storage.local.set({
			
			"Weabot" : Weabot._store
		});
	},
	clearLocalStore : function () {
		chrome.storage.local.remove("Weabot");
	},
	// get 6 day weather report
	getSixWeather : function (id) {
		$.getJSON(Weabot._sixday_url.format(id), function (data) {
			Weabot._store._data = data["weatherinfo"];
			Weabot._store._city = Weabot._store._data["city"];
			Weabot._store._last_fetch_time = (new Date()).getTime();
			Weabot.parseSixWeather();
			Weabot.storeToLocal();
			Weabot.showSixWeather();
		});
	},

	// get real time weather status
	getRealTimeWeather : function (id) {
		$.getJSON(Weabot._realtime_url.format(id), function (data) {
			Weabot._store._sk_data = data["weatherinfo"];
			Weabot._store._sk_last_fetch_time = (new Date()).getTime();
			Weabot.storeToLocal();
			Weabot.showRealTimeWeather(Weabot._store._sk_data);
			$("#container").css("display","");
		});
	},
	
	setGeoLoading : function(){
		$("#city").html("<img src='loading.gif' style='height:20px;width:20px;vertical-align:middle;' />");
	},

	// get city index by geo information
	// load data when success
	getGeo : function (fake_id) {
		Weabot.clearLocalStore();
		Weabot._store = {};
		Weabot.setGeoLoading();
		Weabot.clearSearch();
		// use fake_id for debug
		if ( fake_id != undefined && fake_id != null ){
			Weabot._store._id = fake_id;
			Weabot.getSixWeather(Weabot._store._id);
			Weabot.getRealTimeWeather(Weabot._store._id);
		} else {
			$.get(Weabot._geo_url, function (data) {
				Weabot._store._id = data.match(/id=(\d+);/i)[1];
				Weabot.getSixWeather(Weabot._store._id);
				Weabot.getRealTimeWeather(Weabot._store._id);
			});
		}
	},

	setCity : function () {
		if (Weabot._store._city != null) {
			$("#city").html(Weabot._store._city);
			$("#city").attr("href", Weabot._outlink.format(Weabot._store._id));
		}
	},
	
	setUIOutlink : function(){
		$("#btn-more").attr("href", Weabot._outlink.format(Weabot._store._id));
	},
	getOneDayData : function (index) {
		var max = 6;
		if (Weabot._store._data.fchh >= 18) {
			max = 7;
		}
		if (index > max || index < 1)
			return null;

		var items = Weabot._store._parsed_data;
		var date = new Date(items[1].date);
		date.setDate(date.getDate() + index - 1);
		var cur_items;
		if (max == 6) {
			cur_items = [items[index * 2 - 1], items[index * 2]];
		} else {
			if (index == 1)
				cur_items = [items[1]];
			else if (index == 7)
				cur_items = [items[12]];
			else
				cur_items = [items[index * 2 - 2], items[index * 2 - 1]]
		}
		return cur_items;
	},
	
	getOneDayForUI : function (index) {
		var items = Weabot.getOneDayData(index);
		if ( items == null )
			return null;
		var res = {};
		var date = new Date(items[0].date)
		
		res.date_str = date.toDayString();
		res.single = false;
		res.week = date.toWeek_cn();
		res.image = "<img src='{0}' style='padding:0px 4px;display:inline' />".format(items[0].img);
		res.weather = items[0].img_title;
		res.wind = items[0].wind;
		res.temprature = items[0].temp;
		res.day_night1 = items[0].day_night;
		if ( items.length > 1 ) {
			res.day_night2 = items[0].day_night;
			res.image += "<img src='{0}' style='padding:0px 4px;display:inline' />".format(items[1].img); 
			res.temprature = items[1].temp + "~" + res.temprature;
			if ( items[1].img_title != items[0].img_title )
				res.weather += "转" + items[1].img_title;
			if ( items[1].wind != items[0].wind )
				res.wind += "转" + items[1].wind;
		} else{
			res.single = true;
			res.temprature = items[0].temp_hint + res.temprature;
		}
		return res;
	},
	getOneDayBoxHtml : function (index) {
		var res = Weabot.getOneDayForUI(index);
		if ( res == null )
			return "";
		var title = res.date_str + " " + res.week;
		if ( res.single == true){
			title += " " + res.day_night1;
		}
		var html = "<div style='text-align:center;'>\
						<div style='background-color:#efefef;padding:6px;'>{0}</div>\
					</div>\
					<div style='text-align:center;height:122px;'>\
						<div style='padding: 8px 8px 4px 8px;'>{1}</div>\
						<div style='padding: 4px;'>{2}</div>\
						<div style='padding: 4px;'>{3}</div>\
						<div style='padding: 4px;'>{4}</div>\
					</div>";
		return html.format(title, res.image, res.weather, res.temprature, res.wind);
	},
	
	getOneDayRowHtml : function (index) {
		var res = Weabot.getOneDayForUI(index);
		if ( res == null )
			return "";
		var html = "<tr style='text-align:center;width:360px;'>\
			<td style='background-color:#efefef;width:52px' class='more-border'>{0}<br>{1}</td>\
			<td style='width:140px;' class='more-border'>{2}<br>{3}</td>\
			<td style='width:140px;' class='more-border'>{4}<br>{5}</td>\
		</tr>";
		return html.format(res.date_str, res.week, res.image, res.weather, res.temprature, res.wind);
	},

	// parse weaher information
	parseSixWeather : function () {
		var data = Weabot._store._data;
		var res = [null, ];

		var i = 1;
		var index = 1;
		var date = new Date(data.date_y.replace(/\D/g, " "));

		for (i = 1; i <= 12; i++) {
			res[i] = {};
			var img = WeaImg.getImageUrl(i);
			var winds = data["wind" + index].split("转");
			var wind = winds[0];

			if (i % 2 == 0 && winds.length > 1) {
				wind = winds[1];
			}

			if (img.is_day) {
				var day_night = "白天";
				var temp_hint = "高温";
				var temp = data["temp" + index].split("~")[1];
			} else {
				var day_night = "夜间";
				var temp_hint = "低温";
				var temp = data["temp" + index].split("~")[0];
			}

			//date.toMonthDateString(),
			res[i].date = date.getTime();
			res[i].day_night = day_night;
			res[i].is_day = img.is_day;
			res[i].img_title = data["img_title" + i];
			res[i].img = img.src;
			res[i].temp_hint = temp_hint;
			res[i].temp = temp;
			res[i].wind = wind;

			if (!img.is_day)
				date.setDate(date.getDate() + 1);
			if (i % 2 == 0)
				index += 1;
		}
		this._store._parsed_data = res;
	},
	// show weaher information
	showSixWeather : function () {
		Weabot.setCity();
		var data = Weabot._store._parsed_data;
		$("#today").html(Weabot.getOneDayBoxHtml(1));
		chrome.browserAction.setIcon({path: Weabot._store._parsed_data[1].img});
		var str = "<table style='border-collapse:collapse;'>";
		for ( var i = 2; i <= 7; i ++){
			str += Weabot.getOneDayRowHtml(i);
		}
		str += "<table>";
		$("#details").html(str);
	},

	showRealTimeWeather : function (data) {
		Weabot.setCity();
		$("#sk-time").html(data["time"]);
		if (data["temp"] != "暂无实况")
			$("#sk #temp").html(data["temp"] + "°C");
		else
			$("#sk #temp").html("暂无");
		$("#wind-speed").html(data["WS"]);
		$("#wind").html(data["WD"]);
		$("#wind-div").css("background", "url('" + Wind.getFullUrl(data["WD"]) + "') no-repeat #fff");
		$("#sk").css("display", "inline");
		$("#sk #humidity").html(data["SD"]);
		$("#sk-musk").css("height", ((50 - (data["temp"] - 0)) / 2 + 15) + "px");
		Weabot.setUIOutlink();
		Weabot.Alarm.getAlarm(Weabot._store._id);
	},
	clearSearch : function(){
		$("#search-list").html("");
	},
	errorSearch : function(message){
		$("#search-list").html("<center id='#search-error' style='color: red'>" + message + "</center>");
		window.setTimeout(function() { Weabot.clearSearch(); }, 1000);
	},
	search : function(name){
		Weabot.clearSearch();
		if ( name == undefined || name === "") {
			Weabot.errorSearch("请输入城市名称");
			return;
		}
		$.ajax({
			type : "GET",
			url : Weabot._search_url.format(name),
			success : function(str){
				var json = str.match(/^data\((.+)\)$/)[1];
				var data = $.parseJSON(json);
				if ( data.length === 0 ){
					Weabot.errorSearch("没有找到匹配的城市");
				} else {
					var html = "";
					var count = 0;
					var line = "<tr>\
									<td class='bordered'>{0}</td>\
									<td class='bordered'>{1}</td>\
					                <td class='bordered'><a href='#' search-item-id='{2}'>查看</a></td>\
								</tr>";
					var items = [];
					for ( var i = 0; i < data.length; i ++){
						fields = data[i].ref.split("~");
						if ( fields.length == 10 && fields[0].match(/^\d{9}$/) ){
							items[count] = fields;
							count += 1;
							//      (province/country name, city name,   city_id)
							html += line.format(fields[9], fields[2], fields[0]);
						}
					}
					if ( count > 1 ){
						html = "<div style='margin-bottom:4px;width:360px;'> \
						          <div style='border: 1px solid #efefef;padding:6px;text-align:center'>\
								    搜索结果 " + count + " 条\
								    <span style='float:right;padding-right:8px;'><a href='#' id='search-cancel'>取消</a></span>\
								  </div>\
								  <table style='cell-padding:4px;width:360px;border-collapse:collapse;'>"  + html + "</table>\
								</div>";
						$("#search-list").html(html);
						$("[search-item-id]").click(function(){
							var id = $(this).attr("search-item-id");
							Weabot.clearSearch();
							Weabot.getGeo(id);
						});
						$("#search-cancel").click(function(){
							Weabot.clearSearch();
						});
					} else if ( count == 1) {
						Weabot.getGeo(items[0][0]);
					} else {
						Weabot.errorSearch("请输入具体城市名称");
					}
				}

			}
		});
	},

	init : function (fake_id) {
		// first check the local storage
		// if local storage is not expired, will not fetch data from remote
		chrome.storage.local.get("Weabot", function (items) {
			// load data from local storage if data is set
			if (items && items.Weabot) {
				Weabot._store = items.Weabot;
			}
			// when we have stored data
			// check whether the current data has expired
			// load the expired data if expired
			if (Weabot._store._id != null) {
				// show the data alreay stored first
				Weabot.showSixWeather();
				$("#container").css("display","");
				Weabot.showRealTimeWeather(Weabot._store._sk_data);
				
				// check whether should load new data
				var cur = (new Date()).getTime();
				if ((Weabot._store._last_fetch_time == null) || (cur - Weabot._store._last_fetch_time >= Weabot._fetch_interval)) {
					Weabot.getSixWeather(Weabot._store._id);
					Weabot.getRealTimeWeather(Weabot._store._id);
				} else if ((Weabot._store._sk_last_fetch_time == null) || (cur - Weabot._store._sk_last_fetch_time >= Weabot._sk_fetch_interval)) {
					Weabot.getRealTimeWeather(Weabot._store._id);
					Weabot.showSixWeather();
				}
			} else { //when no data yet, load data from beginnig
				$("#city").html("<span style='font-weight:normal'>欢迎使用Weabot，正在请求天气信息...</span>");
				Weabot.getGeo(fake_id);
			}
		});
	},
	
	test : function(fake_id){
		Weabot.getGeo(fake_id);
		Weabot.Alarm.getAlarm(fake_id);
	}
};

Weabot.Alarm = {
	_alarm_url : "http://product.weather.com.cn/alarm/stationalarm.php?areaid={0}&count=4",
	_file_url : "http://www.weather.com.cn/alarm/newalarmcontent.shtml?file={0}",
	_img_url : "http://www.weather.com.cn/m2/i/alarm_s/{0}.gif",
	_interval : 5*60*1000,
	
	// 预警级别
	yjlb : ['台风','暴雨','暴雪','寒潮','大风','沙尘暴','高温','干旱','雷电','冰雹','霜冻','大雾','霾','道路结冰'],
	// ?
	gdlb : ['寒冷','灰霾','雷雨大风','森林火险','降温','道路冰雪'],
	// 预警颜色
	yjyc : ['蓝色','黄色','橙色','红色'],
	gdyc : ['白色'],
	
	getAlarm : function(id){
		$("#alarms").html("");
		if ( Weabot._store._alarms_last_fetch_time && (new Date()).getTime() - Weabot._store._alarms_last_fetch_time < Weabot.Alarm._interval ){
			Weabot.Alarm.showAlarm();
		} else {
			$.ajax({
				type: "GET",
				url: Weabot.Alarm._alarm_url.format(id),
				success : function(str){
					// var alarminfo={"count":"1","data":[["湖南省","10125-20130423220500-0903.html"]]};
					var json = str.match(/alarminfo=(.+);/)[1];
					var alarminfo = $.parseJSON(json);
					var count = 0;
					var alarms = [];
					$.each(alarminfo.data, function(i, item){
						alarms[count] = {};
						alarms[count].filename = item[1]; // detail file name
						alarms[count].station = item[0];  // station that report the alarm
						var pos = alarms[count].filename.lastIndexOf('-');
						alarms[count].lb = alarms[count].filename.substr(pos + 1, 2); // 类别
						alarms[count].jb = alarms[count].filename.substr(pos + 3, 2); // 级别
						alarms[count].img = alarms[count].lb + alarms[count].jb;
						alarms[count].textlb = Weabot.Alarm.yjlb[parseInt(alarms[count].lb, 10) - 1];
						alarms[count].textyc = Weabot.Alarm.yjyc[parseInt(alarms[count].jb, 10) - 1];
						if (alarms[count].lb > 90 || alarms[count].jb > 90 )
							alarms[count].img = '0000';
						if (alarms[count].lb > 90)
							alarms[count].textlb = Weabot.Alarm.gdlb[parseInt(alarms[count].lb, 10) - 91];
						if (alarms[count].jb > 90)
							alarms[count].textyc = Weabot.Alarm.gdyc[parseInt(alarms[count].jb, 10) - 91];
						alarms[count].notified = false;
						count += 1;
					});
					Weabot._store._alarms = alarms;
					Weabot._store._alarms_last_fetch_time = (new Date()).getTime();
					Weabot.Alarm.showAlarm();
					Weabot.Alarm.showNotify();
				}
			});	
		} 
	},
	showAlarm : function(){
		$("#alarms").html(Weabot.Alarm.getAlarmHtml());
	},
	showNotify : function(){
		
		var text = "{0}发布{1}{2}预警\n";

		if (Weabot._store._alarms && Weabot._store._alarms.length > 0){
			
			$.each(Weabot._store._alarms, function(i, item){
				if (item.notified == false){
					Weabot._store._alarms[i].notified = true;
					Weabot.storeToLocal();
					var str = text.format(item.station, item.textlb, item.textyc);
					var notification = webkitNotifications.createNotification(
						Weabot.Alarm._img_url.format(item.img),
						'天气预警信息',
						str
					);
					notification.show();
				}
			});
		}	 
	},
	
	getAlarmHtml : function(){
		var str = "";
		var text = "<tr>\
			<td class='bordered'><img src='{0}' style='vertical-align:middle' /></td>\
			<td class='bordered'>{1}气象台发布<b>{2}</b>{3}预警  <a href='{4}' target='_blank'>详情</a></td>\
		</tr>";
		if (Weabot._store._alarms && Weabot._store._alarms.length > 0){
			str += "<table style='border-collapse:collapse;margin-bottom:4px;width:100%;'>";
			$.each(Weabot._store._alarms, function(i, item){
				str += text.format(
					Weabot.Alarm._img_url.format(item.img),
					item.station, 
					item.textlb, 
					item.textyc,
					Weabot.Alarm._file_url.format(item.filename)
				);
			});
			str += "</table>";
		}
		return str;
	}
};

// Run our kitten generation script as soon as the document's DOM is ready.
document.addEventListener('DOMContentLoaded', function () {
	// allow the extension to set protected headers
	// for search, you need to provide a Referer to get data
	chrome.webRequest.onBeforeSendHeaders.addListener(
		function(details) {
			details.requestHeaders.push({name:"Referer",value:"http://www.weather.com.cn"});
			return {requestHeaders: details.requestHeaders};
		},
		{urls: ["http://toy1.weather.com.cn/search*"]},
		["requestHeaders", "blocking"]
	);
	
	//Weabot.init("101250101");
	Weabot.init();
	$("#location-btn").click(function(){
		Weabot.getGeo(null);
	});
	
	$("#search-input").keyup(function (e) {
		if (e.keyCode == 13) {
			Weabot.search($("#search-input").val());
		}
	});
	$("#search-btn").click(function(){
		Weabot.search($("#search-input").val());
	});
});
