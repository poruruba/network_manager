'use strict';

const HELPER_BASE = process.env.HELPER_BASE || '../../helpers/';
const Response = require(HELPER_BASE + 'response');
const Redirect = require(HELPER_BASE + 'redirect');

const NETMAN_LISTPATH = process.env.NETMAN_LISTPATH || './data/netman.json';
const NETMAN_DETAIL_BASE = process.env.NETMAN_DETAIL_BASE || './data';

const fs = require('fs');
const uuid = require('uuid');
const dns = require('dns');

try {
  fs.statSync(NETMAN_LISTPATH);
} catch (error) {
  fs.writeFileSync(NETMAN_LISTPATH, JSON.stringify([]), 'utf8');
}

exports.handler = async (event, context, callback) => {
  if( event.path == '/netman-get-list'){
    var body = JSON.parse(event.body);
    console.log(body);

    var list = get_list();
    for( var i = 0 ; i < list.length ; i++ ){
      var detail = get_detail(list[i].uuid);
      list[i].name = detail.name;
      list[i].icon = detail.icon;
    }
    return new Response({ status: 'OK', result: { list } });
  }else
  if( event.path == '/netman-append'){
    var body = JSON.parse(event.body);
    console.log(body);

    var uuid = append_detail(body.detail);

    var list = get_list();
    list.push({ uuid: uuid, parent_uuid: body.parent_uuid });
    put_list(list);
    return new Response({ status: 'OK', result: { uuid } });
  }else
  if( event.path == '/netman-update'){
    var body = JSON.parse(event.body);
    console.log(body);

    var uuid = update_detail(body.detail);
    return new Response({ status: 'OK' });
  }else
  if( event.path == '/netman-remove'){
    var body = JSON.parse(event.body);
    console.log(body);

    remove_detail(body.uuid);

    var list = get_list();
    var new_list = [];
    for( var i = 0 ; i < list.length ; i++ ){
      if( list[i].uuid != body.uuid )
        new_list.push(list[i]);
    }
    for( var i = 0 ; i < new_list.length ; i++ ){
      if(new_list[i].parent_uuid == body.uuid )
        new_list[i].parent_uuid = undefined;
    }
    put_list(new_list);

    return new Response({ status: 'OK' });
  }else
  if( event.path == '/netman-get'){
    var body = JSON.parse(event.body);
    console.log(body);

    var detail = get_detail(body.uuid);
    return new Response({ status: 'OK', result: { detail } });
  }else
  if( event.path == '/netman-change-parent'){
    var body = JSON.parse(event.body);
    console.log(body);

    var list = get_list();
    for( var i = 0 ; i < list.length ; i++ ){
      if( list[i].uuid == body.uuid ){
        list[i].parent_uuid = body.parent_uuid;
        break;
      }
    }
    put_list(list);
    return new Response({ status: 'OK' });
  }else
  if( event.path == '/netman-resolve-ipaddress' ){
    var body = JSON.parse(event.body);
    console.log(body);

    return new Promise((resolve, reject) =>{
      dns.resolve4(body.hostname, (err, addresses) =>{
        if(err)
          return reject(err);

        resolve(new Response({ status: 'OK', result: { addresses }}));
      });
    });
  }
};

function get_list(){
  return JSON.parse(fs.readFileSync(NETMAN_LISTPATH, 'utf8'));
}

function put_list(list){
  fs.writeFileSync(NETMAN_LISTPATH, JSON.stringify(list), 'utf8');
}

function append_detail(detail){
  var target_uuid = uuid.v4();
  detail.uuid = target_uuid;
  fs.writeFileSync(`${NETMAN_DETAIL_BASE}/${target_uuid}.json`, JSON.stringify(detail), 'utf8');
  return target_uuid;
}

function get_detail(target_uuid){
  return JSON.parse(fs.readFileSync(`${NETMAN_DETAIL_BASE}/${target_uuid}.json`, 'utf8'));
}

function update_detail(detail){
  var target = JSON.parse(fs.readFileSync(`${NETMAN_DETAIL_BASE}/${detail.uuid}.json`, 'utf8'));
  Object.keys(detail).forEach((value) =>{
    target[value] = detail[value];
  });
  fs.writeFileSync(`${NETMAN_DETAIL_BASE}/${detail.uuid}.json`, JSON.stringify(target), 'utf8');
}

function remove_detail(target_uuid){
  fs.unlinkSync(`${NETMAN_DETAIL_BASE}/${target_uuid}.json`);
}
