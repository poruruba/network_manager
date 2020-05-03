'use strict';

//var vConsole = new VConsole();

const base_url = 'http://localhost:10080';
const type_list = ['router', 'pc', 'mobile', 'server', 'appliance', 'ethernet'];

var vue_options = {
  el: "#top",
  data: {
    progress_title: '', // for progress-dialog

    tree: null,
    current_node: null,
    current_node_nodes: null,
    current_node_parent_uuid: null,
    target_node: {},
    target_node_parent_uuid: null,
    type_list: type_list,
    change_node_parent_uuid: null,
    node_list: [],
    target_endpoint: {},
    top_uuid: null,
  },
  computed: {
  },
  methods: {
    do_resolve: function(){
      return do_post_netman('/netman-resolve-ipaddress', { hostname: this.target_node.hostname } )
      .then(result =>{
        if( result.addresses.length > 0 ){
          this.target_node.ipaddress = result.addresses[0];
          this.target_node = JSON.parse(JSON.stringify(this.target_node));
        }
      });
    },
    append_endpoint: function() {
      this.target_node = JSON.parse(JSON.stringify(this.current_node));
      if( !this.target_node.endpoints )
        this.target_node.endpoints = [];
      this.target_node.endpoints.push(this.target_endpoint);
      return do_post_netman('/netman-update', { detail: this.target_node } )
      .then(result =>{
        this.dialog_close('#append_endpoint_dialog');
        alert('変更しました。');
        this.update_select_node(this.current_node.uuid);
      });
    },
    do_append_endpoint: function() {
      this.target_endpoint = {};
      this.dialog_open('#append_endpoint_dialog');
    },
    do_remove_endpoint: function(index) {
      if( !window.confirm('本当に削除しますか？'))
        return;

      this.target_node = JSON.parse(JSON.stringify(this.current_node));
      this.target_node.endpoints.splice(index, 1);
      return do_post_netman('/netman-update', { detail: this.target_node } )
      .then(result =>{
        this.dialog_close('#append_endpoint_dialog');
        alert('削除しました。');
        this.update_select_node(this.current_node.uuid);
      });
    },

    do_change_node: function(){
      this.dialog_open('#change_node_dialog');
    },
    change_node: function(){
      try{
        if( this.change_node_parent_uuid == "" )
          this.change_node_parent_uuid = null;
        check_loop(this.node_list, this.top_uuid, this.change_node_parent_uuid, this.current_node.uuid);
        if( this.top_uuid == this.current_node.uuid )
          this.top_uuid = null;
      }catch(error){
        console.log(error);
        alert(error);
        return;
      }

      return do_post_netman('/netman-change-parent', { uuid: this.current_node.uuid, parent_uuid: this.change_node_parent_uuid } )
      .then(result =>{
        this.dialog_close('#change_node_dialog');
        alert('変更しました。');
        this.update_tree(this.top_uuid);
      });
    },
    do_update_node: function(){
      this.target_node = JSON.parse(JSON.stringify(this.current_node));
      this.dialog_open('#update_node_dialog');
    },
    update_node: function(){
      return do_post_netman('/netman-update', { detail: this.target_node } )
      .then(result =>{
        this.dialog_close('#update_node_dialog');
        alert('変更しました。');
        this.update_select_node(this.current_node.uuid);
      });
    },
    do_remove_node: function(uuid){
      if( !window.confirm('本当に削除しますか？'))
        return;

      return do_post_netman('/netman-remove', { uuid: this.current_node.uuid } )
      .then(result =>{
        alert('削除しました。');
        this.update_tree(this.top_uuid);
        if( this.top_uuid == this.current_node.uuid )
          this.top_uuid = null;
        this.current_node = null;
      });
    },
    do_append_node: function() {
      this.target_node = {};
      this.target_node_parent_uuid = (this.current_node) ? this.current_node.uuid : null;
      this.dialog_open('#append_node_dialog');
    },
    append_node: async function() {
      return do_post_netman('/netman-append', { detail: this.target_node, parent_uuid: this.target_node_parent_uuid } )
      .then(result =>{
        this.dialog_close('#append_node_dialog');
        alert('追加しました。');
        this.update_tree(this.top_uuid);
      });
    },

    do_set_root: function(top_uuid) {
      try{
        check_loop(this.node_list, top_uuid);
      }catch(error){
        console.log(error);
        alert(error);
        return;
      }

      this.top_uuid = top_uuid;
      Cookies.set('top_uuid', this.top_uuid);
      this.update_tree(this.top_uuid);
    },

    node_selected: async function(event, data) {
      this.update_select_node(data.uuid);
      if (data.uuid)
        this.current_node_parent_uuid = data.parent_uuid;
      else
        this.current_node_parent_uuid = '';
    },
    update_select_node: async function(uuid){
      if( uuid ){
        var result = await do_post_netman('/netman-get', {
          uuid: uuid
        });
        this.current_node = result.detail;
      }else{
        this.current_node = null;
      }
      var data = this.tree.treeview('getSelected');
      this.current_node_nodes = data[0].nodes;
    },
    select_node: function(node){
      this.tree.treeview('selectNode', node);
    },
    update_tree: async function(top_uuid) {
      var result = await do_post_netman('/netman-get-list');
      this.node_list = result.list;

      var trees = get_top_and_orphan(result.list, top_uuid);
      var data = [];
      if( trees.top )
        data.push(trees.top);
      data.push({
        text: '未所属',
        nodes: trees.orphan,
      });

      this.tree.treeview({
        data: data,
        levels: 10,
      });
      this.tree.on('nodeSelected', this.node_selected);
    },
  },
  created: function() {
  },
  mounted: function() {
    proc_load();

    this.tree = $('#tree');

    this.top_uuid = Cookies.get('top_uuid');
    this.do_set_root(this.top_uuid);
  }
};
vue_add_methods(vue_options, methods_bootstrap);
vue_add_components(vue_options, components_bootstrap);
var vue = new Vue(vue_options);

function do_post_netman(endpoint, body) {
  return do_post(base_url + endpoint, body)
    .then(json => {
      if (json.status != 'OK')
        throw 'post failed';

      return json.result;
    });
}

function do_post(url, body) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8"
  });

  return fetch(new URL(url).toString(), {
      method: 'POST',
      body: JSON.stringify(body),
      headers: headers
    })
    .then((response) => {
      if (!response.ok)
        throw 'status is not 200';
      return response.json();
    });
}

function make_node(target){
  return {
    text: target.name,
    uuid: target.uuid,
    parent_uuid: target.parent_uuid,
    icon: ( target.icon ) ? "fas " + target.icon : undefined,
  };
}

function check_loop(list, top_uuid, parent_uuid, target_uuid){
  if( top_uuid == null )
    return;
  
  for( var i = 0 ; i < list.length ; i++ )
    list[i].isMarked = false;

  set_mark(list, top_uuid, target_uuid);
 
  if( parent_uuid == null || target_uuid == null )
    return;
  if( top_uuid == target_uuid )
    return;
  if(parent_uuid == target_uuid )
    throw 'invalid uuid';

  var top_index = find_element(list, top_uuid);
  if( top_index < 0 )
    throw 'not found';
  var parent_index = find_element(list, parent_uuid);
  if( parent_index < 0 )
    throw 'not found';
  var target_index = find_element(list, target_uuid);
  if( target_index < 0 )
    throw 'not found';

  if( !list[parent_index].isMarked )
    return;

  set_mark(list, target_uuid, null);
}

function set_mark(list, base_uuid, except_uuid) {
  var index = find_element(list, base_uuid);
  if( index < 0 )
    return;

  if( list[index].isMarked )
    throw 'looped';

  list[index].isMarked = true;

  for (var i = 0; i < list.length; i++) {
    if (list[i].parent_uuid == base_uuid){
      if( list[i].uuid == except_uuid)
        continue;
      set_mark(list, list[i].uuid, except_uuid);
    }
  }
}

function get_top_and_orphan(list, top_uuid){
  for( var i = 0 ; i < list.length ; i++ )
    list[i].isMarked = false;

  var top = get_trees(list, top_uuid);

  var orphan = [];
  for (var i = 0; i < list.length; i++) {
    if (!list[i].isMarked) {
      orphan.push( make_node(list[i]) );
    }
  }

  return { top, orphan };
}

function find_element(list, uuid){
  for (var i = 0; i < list.length; i++) {
    if (list[i].uuid == uuid)
      return i;
  }

  return -1;
}

function get_trees(list, uuid) {
  var index = find_element(list, uuid);
  if( index < 0 )
    return null;

  if( list[index].isMarked )
    throw 'looped';
  list[index].isMarked = true;
  var element = make_node(list[index]);

  element.nodes = [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].parent_uuid == uuid)
      element.nodes.push(get_trees(list, list[i].uuid));
  }

  return element;
}
