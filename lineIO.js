"use strict";
//handy routines for line-oriented communications protocols
var events=require("events");
var util=require("util");


function LineIO(myconn) //inherits-from...
{
  this.conn=myconn;
  var buffer='';
  var that=this;
  events.EventEmitter.call(this);
  var linecount=0;
  var line_end;
  var line_emitter=function () {
    if(!activated) {
      console.warn("Deactivated stream - ")
      return;
    }
    if(buffer.indexOf("\r\n") !== -1) {
      linecount++;
      line_end=buffer.indexOf("\r\n");
      console.warn("FOUND line end at: "+line_end);
      if(line_end>998) {
        that.emit('error',{name: "LengthError",message: "line is too long: "+line_end+2+" characters"});
      } else {
        var chunk_to_emit=buffer.substring(0,line_end);
        console.warn("Chunk to emit '"+chunk_to_emit+"'");
        if(!that.emit('line',chunk_to_emit)) {
          console.warn("We tried to emit, but no one was listening!!!");
          throw new Error("What the heck?");
          process.nextTick(line_emitter);
          return;
        }
      }
      buffer=buffer.slice(line_end+2); //skip past the \r\n
      console.warn("Remaining buffer: '"+buffer+"'");
      if(linecount>10) {
        throw new Error("TOO MANY LINES IN ONE PACKET!")
      }
      process.nextTick(line_emitter);
    } else {
      console.warn("No CRNL found!");
    }
  };
  var listener=function () {
    linecount=0; //reset linecount!
    buffer+=that.conn.read();
    console.warn("listener invoked? Buffer is now: "+buffer);
    /*if(buffer.length>16384) {
      throw new Error("Huge buffer.");
    }*/
    line_emitter();
  };
  var activated=false;

  this.remoteAddress=this.conn.remoteAddress;

  this.on('newListener',function (name) {
    if(name=="line") {
      console.warn("New line listener found! PRevious activation status: "+activated);
      if(!activated) {
        that.conn.on('readable',listener);
        activated=true;
        //if we still had data in the buffer waiting to go,
        //and now we have a new listener - start emitting lines
        //again.
        if(buffer.length>0) {
          process.nextTick(line_emitter); //MUST do this async or you may emit
                                          //lines before everyone's ready!
                                          //can we end up double-emitting somehow?
                                          //e.g. we're eating up buffer *here*
                                          //and also the readable event's callback
                                          //fires and now we have two people
                                          //trying to eat the buffer?
        }
      }
    }
  });
  this.on('removeListener',function (name) {
    console.warn("Removing listener for "+name);
    if(name==="line" && events.EventEmitter.listenerCount(that.conn,"line")===0) {
      console.warn("DEACTIVATE CALLED! Previous status: "+activated);
      if(activated) {
        that.conn.removeListener('readable',listener);
        activated=false;
      }
    }
  });
  this.conn.on('end',function () {
    that.emit("end");
  });
  this.conn.on('error',function (err) {
    that.emit("error",err);
  });
  this.conn.on('connect',function () {
    that.emit("connect");
  });
}

util.inherits(LineIO, events.EventEmitter);

LineIO.prototype.write= function (line,optcallback) {
  if(!optcallback) {
    optcallback=function () {};
  }
  this.conn.write(line+"\r\n",optcallback);
};

//LineIO.prototype.command=function (line)

LineIO.prototype.end=function (optional) {
  if(optional) {
    this.write(optional);
  }
  this.conn.end();
};

module.exports=LineIO;
