'use strict';

//var vConsole = new VConsole();

const base_url = 'http://localhost:10080';
const type_list = ['router', 'pc', 'mobile', 'server', 'appliance', 'ethernet'];

var vue_options = {
  el: "#top",
  data: {
    progress_title: '', // for progress-dialog

    current_tree_node: null,
    current_node_uuid: null,
    current_node: null,
    target_node: {},
    type_list: type_list,
    change_node_parent_uuid: null,
    node_list: [],
    target_endpoint: {},
    top_uuid: null,
    search_name: '',
  },
  computed: {
  },
  methods: {
    // ツリー検索
    do_search: function(){
      var ret = $('#tree').treeview('search', [this.search_name]);
      if( ret.length > 0 )
        this.select_node(ret[0]);
    },
    do_search_clear: function(){
      this.search_name = '';
      $('#tree').treeview('clearSearch');
    },

    // IPアドレスの正引き
    do_resolve: function(){
      return do_post_netman('/netman-resolve-ipaddress', { hostname: this.target_node.hostname } )
      .then(result =>{
        if( result.addresses.length > 0 ){
          this.target_node.ipaddress = result.addresses[0];
          this.target_node = JSON.parse(JSON.stringify(this.target_node));
        }
      });
    },

    // エンドポイント管理
    append_endpoint: function() {
      var detail = JSON.parse(JSON.stringify(this.current_node));
      if( !detail.endpoints )
        detail.endpoints = [];
      detail.endpoints.push(this.target_endpoint);
      return do_post_netman('/netman-update', { detail: detail } )
      .then(async (result) =>{
        this.dialog_close('#append_endpoint_dialog');
        alert('追加しました。');
        await this.update_selected_node();
      });
    },
    do_append_endpoint: function() {
      this.target_endpoint = {};
      this.dialog_open('#append_endpoint_dialog');
    },
    do_remove_endpoint: function(index) {
      if( !window.confirm('本当に削除しますか？'))
        return;

      var detail = JSON.parse(JSON.stringify(this.current_node));
      detail.endpoints.splice(index, 1);
      return do_post_netman('/netman-update', { detail: detail } )
      .then(async (result) =>{
        this.dialog_close('#append_endpoint_dialog');
        alert('削除しました。');
        await this.update_selected_node();
      });
    },
    expand_endpoint: function(node, endpoint){
      var t1 = endpoint.replace('${ipaddress}', node.ipaddress);
      var t2 = t1.replace('${hostname}', node.hostname);
      return t2;
    },


    // ノードの場所の変更
    do_change_node: function(){
      this.change_node_parent_uuid = this.current_tree_node.parent_uuid;
      this.dialog_open('#change_node_dialog');
    },
    change_node: function(){
      try{
        var target_uuid = this.current_node.uuid;
        if( this.change_node_parent_uuid == "" )
          this.change_node_parent_uuid = null;
        check_loop(this.node_list, this.top_uuid, this.change_node_parent_uuid, target_uuid);
      }catch(error){
        console.log(error);
        alert(error);
        return;
      }

      return do_post_netman('/netman-change-parent', { uuid: target_uuid, parent_uuid: this.change_node_parent_uuid } )
      .then(async (result) =>{
        this.dialog_close('#change_node_dialog');
        alert('変更しました。');
        if( this.top_uuid == target_uuid )
          this.top_uuid = null;
        await this.update_tree();
        this.select_node_uuid(target_uuid);
      });
    },

    // ノードの内容の変更
    do_update_node: function(){
      this.target_node = JSON.parse(JSON.stringify(this.current_node));
      this.dialog_open('#update_node_dialog');
    },
    update_node: function(){
      return do_post_netman('/netman-update', { detail: this.target_node } )
      .then(async (result) =>{
        this.dialog_close('#update_node_dialog');
        alert('変更しました。');
        await this.update_selected_node();
      });
    },

    // ノードの削除
    do_remove_node: function(uuid){
      if( !window.confirm('本当に削除しますか？'))
        return;

      var target_uuid = this.current_node.uuid;
      return do_post_netman('/netman-remove', { uuid: target_uuid } )
      .then(async (result) =>{
        alert('削除しました。');
        if( this.top_uuid == target_uuid ){
          this.top_uuid = null;
          Cookies.set('top_uuid', this.top_uuid);
        }
        this.current_node_uuid = this.current_tree_node.parent_uuid;
        await this.update_tree();
        this.select_node_uuid(this.current_node_uuid);
      });
    },

    // ノードの追加
    do_append_node: function() {
      this.target_node = {};
      this.dialog_open('#append_node_dialog');
    },
    append_node: async function() {
      return do_post_netman('/netman-append', { detail: this.target_node, parent_uuid: (this.current_node) ? this.current_node.uuid : null } )
      .then(async (result) =>{
        this.dialog_close('#append_node_dialog');
        alert('追加しました。');
        await this.update_tree();
        this.select_node_uuid(this.current_node_uuid);
      });
    },

    // ツリーのルート設定
    do_set_root: async function(top_uuid) {
      try{
        check_loop(this.node_list, top_uuid);
      }catch(error){
        console.log(error);
        alert(error);
        return;
      }

      this.top_uuid = top_uuid;
      Cookies.set('top_uuid', this.top_uuid);
      this.current_node_uuid = this.top_uuid;
      await this.update_tree();
      await this.update_selected_node();
    },

    // UUIDからツリーのノードを検索
    search_node_uuid: function(uuid){
      var data = $('#tree').treeview('getNode', 0);
      return search_tree_node(data, uuid);
    },

    // ツリーのノード選択時
    node_selected: async function(event, data) {
      console.log('nodeSelected');
      this.current_node_uuid = data.uuid;
      this.current_tree_node = data;
      this.parent_tree_node = this.search_node_uuid(data.parent_uuid);
      await this.update_selected_node();
    },

    // ツリーの手動選択
    select_node: function(node){
      if( node != null ){
        $('#tree').treeview('selectNode', [node]);
        $('#tree').treeview('revealNode', node);
      }else{
        this.current_node = null;
        this.current_tree_node = null;
        this.parent_tree_node = null;
      }
    },
    // ツリーの手動選択(UUID指定)
    select_node_uuid: function(uuid){
      var node = this.search_node_uuid(uuid);
      this.select_node(node);
    },

    // ノードの表示更新
    update_selected_node: async function(){
      if( this.current_node_uuid != null){
        var result = await do_post_netman('/netman-get', { uuid: this.current_node_uuid });
        this.current_node = result.detail;
      }else{
        this.current_node = null;
      }
    },

    // ツリーの表示更新
    update_tree: async function() {
      var result = await do_post_netman('/netman-get-list');
      this.node_list = result.list;

      var trees = get_top_and_orphan(result.list, this.top_uuid);

      var data = [];
      if( trees.top )
        data.push(trees.top);
      data.push({
        text: '未接続',
        nodes: trees.orphan,
      });

      $('#tree').treeview({
        data: data,
        levels: 10,
        showTags: true,
      });
      $('#tree').on('nodeSelected', this.node_selected);
    },
  },
  created: function() {
  },
  mounted: function() {
    proc_load();

    // ツリーのルート復元
    this.top_uuid = Cookies.get('top_uuid');
    this.current_node_uuid = this.top_uuid;
    this.update_tree()
    .then(() =>{
      this.select_node_uuid(this.current_node_uuid);
    });
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


function find_element(list, uuid){
  for (var i = 0; i < list.length; i++) {
    if (list[i].uuid == uuid)
      return i;
  }

  return -1;
}

function search_tree_node(data, uuid){
  if(data.uuid == uuid )
    return data;

  if( !data.nodes )
    return null;
	
  for( var i = 0 ; i < data.nodes.length ; i++ ){
    var node = search_tree_node(data.nodes[i], uuid );
    if( node != null )
      return node;
  }

  return null;
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


function make_node(target){
  return {
    text: target.name,
    icon: target.icon,
    uuid: target.uuid,
    parent_uuid: target.parent_uuid,
  };
}

function get_top_and_orphan(list, top_uuid){
  for( var i = 0 ; i < list.length ; i++ )
    list[i].isMarked = false;

  var top = make_trees(list, top_uuid);

  var orphan = [];
  for (var i = 0; i < list.length; i++) {
    if (!list[i].isMarked) {
      orphan.push( make_node(list[i]) );
    }
  }

  return { top, orphan };
}

function make_trees(list, uuid) {
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
      element.nodes.push(make_trees(list, list[i].uuid));
  }
  if( element.nodes.length > 0 )
	  element.tags = [String(element.nodes.length)];

  return element;
}
