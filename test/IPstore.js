"use strict";

var assert = require("assert");
var IPstore=require("../IPstore.js");

var db=new IPstore(2,3); //duration 2 seconds, threshhold 3

describe('IPstore',function () {
  describe('#store',function () {
    it('should be able to store elements under threshhold',function () {
      db.store("1.2.3.4");
      db.store("1.2.3.4");
      assert(!db.lookup("1.2.3.4"));
    });
    it('should be able to recognize when things are at or above threshhold',function () {
      db.store("1.2.3.4");
      assert(db.lookup("1.2.3.4"));
    });
  });
  describe('##binaryIndexOf',function () {
    var arr=[1,2,3,4,5,6,7];
    var fun=function (i) {
      return IPstore.binaryIndexOf.call(arr,i);
    };
    var fun_assert=function (i,j) {
      assert.equal(fun(i),j,"Can't find "+i+" (got "+fun(i)+"["+~fun(i)+"], was looking for "+j+"["+~j+"])");
    };
    it('exact matches should work',function () {
      fun_assert(1,0);
      fun_assert(2,1);
      fun_assert(3,2);
      fun_assert(4,3);
      fun_assert(5,4);
    });
    it('mismatches should work',function () {
      fun_assert(0.5,~0);
      fun_assert(1.5,~1);
      fun_assert(2.5,~2);
      fun_assert(5.5,~5);
    });
  });
  describe('#find_index',function () {
    this.timeout(10000);
    it('should be able to find basic things',function (done) {
      db.store("4.5.6.7");
      setTimeout(function () {
        db.store("4.5.6.7");
        setTimeout(function () {
          db.store("4.5.6.7");
          assert.equal(db.find_index("4.5.6.7"),0);
          setTimeout(function () {
            db.store("4.5.6.7");
            assert.equal(db.find_index("4.5.6.7"),1);
            done();
          },900);
        },900);
      },900);
    });
  });
  describe('#cleanup',function () {
    this.timeout(10000);
    it('should be able to clean only the elements that expire',function (done) {
      db.store("2.3.4.5");
      setTimeout(function () {
        db.store("2.3.4.5");
        db.store("2.3.4.5");
        assert(db.lookup("2.3.4.5"));
        setTimeout(function () {
          console.warn("HEY!");
          assert(!db.lookup("2.3.4.5"));
          done();
        },1800);
      },1800);
    });
    it("shouldn't expire elements that aren't ready to go yet",function (done) {
      db.store("3.4.5.6");
      db.store("3.4.5.6");
      db.store("3.4.5.6");
      assert(db.lookup("3.4.5.6"),"Three entries should return true!");
      setTimeout(function () {
        console.warn("SERIOUS");
        assert(db.lookup("3.4.5.6"),"should still be true because not enough time should've elapsed");
        done();
      },1800);
    })
  })
});
