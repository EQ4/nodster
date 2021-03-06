;"use strict";
var request = require("request");
var http = require('http');
var fs = require("fs");
var mm = require('musicmetadata');
var gui = require('nw.gui');
var events = require('events');

// CONFIG
var maximum = 10; // maximum of mp3s it will find
var minimum = 2000000; // minimum of bits(decimals) a mp3 must have

// AUDIO HTML5
var audio = new Audio();
audio.src = 'buffer.mp3';

// CUSTOM EVENTS
var nodster = new events.EventEmitter();


//
// CORE
//

// Get the audio from url into a stream
var buffering = false;

var buffer;

function getAudio(url){

    // init
    buffer = fs.createWriteStream('buffer.mp3');
    buffering = true;
    var buffed = 0;

    // view
    $('.progress').width(0);

    // request
    http.get(url, function(res) {
        if(res.statusCode != 200){
            alert('no mp3');
            return false;
        }

        // view
        $('.progress').fadeIn();

        // starting to buffer

        // if a new file wants to be buffered we kill this one
        nodster.once('new', function(){
            buffer.end();
            res.destroy();
        });

        // buffering
        res.on('data', function(chunk) {
            buffer.write(chunk);
            buffed += chunk.length;
            $('.progress').width(buffed * 100 / res.headers['content-length']+ '%');
        });

        // file downloaded
        res.on('end', function() {
            // we play mp3
            audio.load();
            audio.play();
            // view
            $('.progress').fadeOut();
            if($('.play').attr('display') != 'none')
            {
                $('.play').hide();
                $('.pause').show();
            }
            // we clear
            buffering = false;
            nodster.emit('clear');
        });
    }).on('error', function(e) {
      console.log("Got error: " + e.message);
    });
}

// Function called after a search ends
function end_search(){
    $('.fa-spin').hide();
    $('input[type=submit]').show();
}

var mp3s_found = 0;
var list_mp3s = [];

// Check each link that google gives us
function check_link(links, ii){

    request(links[ii], function(error, response, body) {

        if(!error && response.statusCode == 200){
            /* using jQuery to parse the html,
            this produces error in the console,
            the document is trying to GET images
            that are on the page :s */
            $(body).find('a').each(function(index){
                var href = $(this).attr('href');

                // check + metadata
                if(href !== undefined && href.indexOf(".mp3") > 10 && href.indexOf("http") > -1 && $.inArray(href, list_mp3s) == -1 && check_mp3(href)){
                    list_mp3s.push(href);
                    mp3s_found++;
                }
            })
        }
        else
            console.log('can\'t access link',links[ii], links[ii].indexOf("mp3"), error);

        // next links
        ii++;
        if(ii < links.length){
            check_link(links, ii);
        }
        // End search
        else{
            console.log("found "+mp3s_found+" files");
            end_search();
        }
    });
}

// check distant mp3 file for metadatas
function check_mp3(url){

    console.log("checking mp3",url);
    http.get(url, function(res){
        // simple checks
        if(res.statusCode == 200 && res.headers['content-length'] !== undefined && res.headers['content-length'] > minimum){

            var parser = mm(res);
            parser.once('metadata', function (result) {
                // format name
                var name = url.match(/([^/]*)(?=\.mp3)/)[0];
                if(result.title != ""){
                    if(result.artist[0] != "" && result.title.indexOf(result.artist[0]) > -1)
                        name = result.title;
                    else
                        name = result.artist[0]+' - '+result.title;
                    // remove url from name
                    name = name.replace(/\(?\w+\.(net|com|ru|info)\)?/gi, '');
                    name = name.replace(/(\(?www\.[a-z]+\.[a-z]+\)?)/gi, '');
                    name = name.replace('.mp3', '');
                }
                // view
                document.getElementById('end').insertAdjacentHTML('beforebegin', '<li><a href="'+url+'" class="mp3" title="'+res.headers['content-length']+'">'+name+'</a></li>');
                res.destroy();

                return true;
            });
        }
        else{
            res.destroy();
            return false;
        }
    }).on('error', function(e) {
        console.log("error: ",url, e.message);
        return false;
    });
}

// new search
function search(){
    // init
    mp3s_found = 0;
    list_mp3s = [];
    // view
    $('.mp3').parent().remove();
    $('.fa-spin').show();
    $('input[type=submit]').hide();

    // format search
    var search = document.getElementById('music').value;
    search = search.replace(' ', '+') + ' mp3 -facebook -youtube -soundcloud -last.fm -amazon -dailymotion -bleep';

    // check google links
    request('http://www.google.com/search?q='+search, function(error, response, body){

        var links = [];

        // parse relevant links
        // (could avoid & at the end with /http[^&]*/g)
        $(body).find('.r a').each(function(index){
            try{
                links.push($(this).attr('href').match(/http.*/g)[0]);
            }
            catch(err){
                console.log(err);
            }
        });

        console.log(links);

        // let's check those websites
        if(links.length > 0){
            check_link(links, 0);
        }

    });
}


//
// EVENTS
//

// on search submit
document.getElementById('search').addEventListener('submit', function(e){

    // search
    search();

    //
    e.preventDefault();
});

// get mp3
$(document).on('click', '.mp3', function(e){

    // we are the FIRST!
    nodster.removeAllListeners("clear");

    //
    var href = $(this).attr('href');

    // view
    $('.active').removeClass('active');
    $(this).addClass('active');
    $('.info').html($(this).text());

    // we wait for clearance
    nodster.once('clear', function(){
        // launch
        pause();
        getAudio(href);
    });

    // if something is already buffering
    if(buffering){
        nodster.emit('new');
    }
    else{
        nodster.emit('clear');
    }


    //
    e.preventDefault();
});

// play button
$('.play').click(function(){
    if($('.play').attr('display') != 'none')
    {
        $('.play').hide();
        $('.pause').show();
    }
    audio.play();
    return false;
});

// pause button
function pause(){
    $('.pause').hide();
    $('.play').show();
    audio.pause();
}
$('.pause').click(function(){
    pause();
    return false;
});

// close button
$('.close').click(function(){
    gui.Window.get().close();
});

//
// DYNAMIC AUDIO VISUALISATION
//

var duration;

// duration of the song
audio.addEventListener('durationchange', function() {
    duration = audio.duration
})

// update time of music
audio.addEventListener('timeupdate', function (){
    var curtime = parseInt(audio.currentTime, 10) * 100 / duration
    $(".load").css("width", curtime + "%")
})