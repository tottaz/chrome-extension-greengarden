/**
 * Library of functions for the "server" portion of an extension, which is
 * loaded into the background and popup pages.
 *
 * Some of these functions are asynchronous, because they may have to talk
 * to the Greengarden API to get results.
 */
Greengarden.ServerModel = {

  _cached_user: null,

  /**
   * Called by the model whenever a request is made and error occurs.
   * Override to handle in a context-appropriate way. Some requests may
   * also take an `errback` parameter which will handle errors with
   * that particular request.
   *
   * @param response {dict} Response from the server.
   */
  onError: function(response) {},

  /**
   * Requests the user's preferences for the extension.
   *
   * @param callback {Function(options)} Callback on completion.
   *     categories {dict[]} See Greengarden.Options for details.
   */
  options: function(callback) {
    callback(Greengarden.Options.loadOptions());
  },

  /**
   * Determine if the user is logged in.
   *
   * @param callback {Function(is_logged_in)} Called when request complete.
   *     is_logged_in {Boolean} True iff the user is logged in to Greengarden.
   */
  isLoggedIn: function(callback) {
    chrome.cookies.get({
      url: Greengarden.ApiBridge.baseApiUrl(),
      name: 'gp_media'
    }, function(cookie) {
      callback(!!(cookie && cookie.value));
    });
  },

  /**
   * Get the URL of a media item and given some of its data.
   *
   * @param newsitem {dict}
   * @param callback {Function(url)}
   */
  newsitemViewUrl: function(newsitem, callback) {
    // We don't know what pot to view it in so we just use the newsid ID
    // and Greengarden will choose a suitable default.
    var options = Greengarden.Options.loadOptions();
    var pot_id = newsitem.id;
    var url = 'http://' + options.greengarden_host_port + '/api/1/newsitem/' + pot_id + '/' + newsitem.id;
    callback(url);
  },

  /**
   * Requests the set of categories the logged-in user is in.
   *
   * @param callback {Function(categories)} Callback on success.
   *     categories {dict[]}
   */
  categories: function(callback, errback) {
    var self = this;
    Greengarden.ApiBridge.request("GET", "/categories", {},
        function(response) {
          self._makeCallback(response, callback, errback);
        });
  },

  /**
   * Requests the set of users in a categories.
   *
   * @param callback {Function(users)} Callback on success.
   *     users {dict[]}
   */
  users: function(workspace_id, callback) {
    var self = this;
    Greengarden.ApiBridge.request("GET", "/categories/" + workspace_id + "/users", {},
        function(response) {
          self._makeCallback(response, callback);
        });
  },

  /**
   * Requests the user record for the logged-in user.
   *
   * @param callback {Function(user)} Callback on success.
   *     user {dict[]}
   */
  me: function(callback) {
    var self = this;
    if (self._cached_user !== null) {
      callback(self._cached_user);
    } else {
      Greengarden.ApiBridge.request("GET", "/users/me", {},
          function(response) {
            if (!response.errors) {
              self._cached_user = response.data;
            }
            self._makeCallback(response, callback);
          });
    }
  },

  /**
   * Makes an Greengarden API request to add a news item in the system.
   *
   * @param newsitem {dict} Task fields.
   * @param callback {Function(response)} Callback on success.
   */
  createNewsitem: function(workspace_id, newsitem, callback, errback) {
    var self = this;
    Greengarden.ApiBridge.request(
        "POST",
        "/newsitems/" + workspace_id + "/newsitems",
        newsitem,
        function(response) {
          self._makeCallback(response, callback, errback);
        });
  },

  _makeCallback: function(response, callback, errback) {
    if (response.errors) {
      (errback || this.onError).call(null, response);
    } else {
      callback(response.data);
    }
  }

};