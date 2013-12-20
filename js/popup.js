window.addEventListener('load', function() {

  // Our default error handler.
  Greengarden.ServerModel.onError = function(response) {
    showError(response.errors[0].message);
  };

  // Ah, the joys of asynchronous programming.
  // To initialize, we've got to gather various bits of information.
  // Starting with a reference to the window and tab that were active when
  // the popup was opened ...
  chrome.windows.getCurrent(function(w) {
    chrome.tabs.query({
      active: true,
      windowId: w.id
    }, function(tabs) {
      // Now load our options ...
      Greengarden.ServerModel.options(function(options) {
        // And ensure the user is logged in ...
//        Greengarden.ServerModel.isLoggedIn(function(is_logged_in) {
//          if (is_logged_in) {
            if (window.quick_add_request) {
              // If this was a QuickAdd request (set by the code popping up
              // the window in Greengarden.ExtensionServer), then we have all the
              // info we need and should show the add UI right away.
              showAddUi(
                  quick_add_request.url, quick_add_request.title,
                  quick_add_request.selected_text, options);
            } else {
              // Otherwise we want to get the selection from the tab that
              // was active when we were opened. So we set up a listener
              // to listen for the selection send event from the content
              // window ...
              var selection = "";
              var listener = function(request, sender, sendResponse) {
                if (request.type === "selection") {
                  chrome.extension.onRequest.removeListener(listener);
                  console.info("Greengarden popup got selection");
                  selection = "\n" + request.value;
                }
              };
              chrome.extension.onRequest.addListener(listener);

              // ... and then we make a request to the content window to
              // send us the selection.
              var tab = tabs[0];
              chrome.tabs.executeScript(tab.id, {
                code: "(Greengarden && Greengarden.SelectionClient) ? Greengarden.SelectionClient.sendSelection() : 0"
              }, function() {
                // The requests appear to be handled synchronously, so the
                // selection should have been sent by the time we get this
                // completion callback. If the timing ever changes, however,
                // that could break and we would never show the add UI.
                // So this could be made more robust.
                showAddUi(tab.url, tab.title, selection, options);
              });
            }
//          } else {
            // The user is not even logged in. Prompt them to do so!
//            showLogin(Greengarden.Options.loginUrl(options));
//          }
//        });
      });
    });
  });
});

// Helper to show a named view.
var showView = function(name) {
  ["login", "add", "success"].forEach(function(view_name) {
    $("#" + view_name + "_view").css("display", view_name === name ? "" : "none");
  });
};

// Show the add UI
var showAddUi = function(url, title, selected_text, options) {
  var self = this;
  showView("add");
  $("#url").val(url + selected_text);
  $("#title").val(title);
  $("#title").focus();
  $("#title").select();
  Greengarden.ServerModel.me(function(user) {
    // Just to cache result.
    Greengarden.ServerModel.workspaces(function(workspaces) {
      $("#category").html("");
      workspaces.forEach(function(workspace) {
        $("#category").append(
            "<option value='" + workspace.id + "'>" + workspace.name + "</option>");
      });
      $("#category").val(options.default_workspace_id);
      onWorkspaceChanged();
      $("#category").change(onWorkspaceChanged);
    });
  });
};

// Enable/disable the add button.
var setAddEnabled = function(enabled) {
  var button = $("#add_button");
  if (enabled) {
    button.removeClass("disabled");
    button.addClass("enabled");
    button.click(function() {
      createTask();
      return false;
    });
    button.keydown(function(e) {
      if (e.keyCode === 13) {
        createTask();
      }
    });
  } else {
    button.removeClass("enabled");
    button.addClass("disabled");
    button.unbind('click');
    button.unbind('keydown');
  }
};

// Set the add button as being "working", waiting for the Greengarden request
// to complete.
var setAddWorking = function(working) {
  setAddEnabled(!working);
  $("#add_button").find(".button-text").text(
      working ? "Adding..." : "Add to Greengarden");
};

// When the user changes the workspace, update the list of users.
var onWorkspaceChanged = function() {
  var workspace_id = readWorkspaceId();
  $("#assignee").html("<option>Loading...</option>");
  setAddEnabled(false);
  Greengarden.ServerModel.users(workspace_id, function(users) {
    $("#assignee").html("");
    users = users.sort(function(a, b) {
      return (a.name < b.name) ? -1 : ((a.name > b.name) ? 1 : 0);
    });
    users.forEach(function(user) {
      $("#assignee").append(
          "<option value='" + user.id + "'>" + user.name + "</option>");
    });
    Greengarden.ServerModel.me(function(user) {
      $("#assignee").val(user.id);
    });
    setAddEnabled(true);
  });
};

var readAssignee = function() {
  return $("#assignee").val();
};

var readWorkspaceId = function() {
  return $("#category").val();
};

var createNewsitem = function() {
  console.info("Creating News Item");
  hideError();
  setAddWorking(true);
  Greengarden.ServerModel.createTask(
      readWorkspaceId(),
      {
        title: $("#title").val(),
        url: $("#url").val(),
        assignee: readAssignee()
      },
      function(newsitem) {
        setAddWorking(false);
        showSuccess(newsitem);
      },
      function(response) {
        setAddWorking(false);
        showError(response.errors[0].message);
      });
};

var showError = function(message) {
  console.log("Error: " + message);
  $("#error").css("display", "");
};

var hideError = function() {
  $("#error").css("display", "none");
};

// Helper to show a success message after a newsitem is added.
var showSuccess = function(newsitem) {
  Greengarden.ServerModel.newsitemViewUrl(newsitem, function(url) {
    var name = newsitem.name.replace(/^\s*/, "").replace(/\s*$/, "");
    $("#new_newsitem_link").attr("href", url);
    $("#new_newsitem_link").text(name !== "" ? name : "unnamed newsitem");
    $("#new_newsitem_link").unbind("click");
    $("#new_newsitem_link").click(function() {
      chrome.tabs.create({url: url});
      window.close();
      return false;
    });
    showView("success");
  });
};

// Helper to show the login page.
var showLogin = function(url) {
  $("#login_link").attr("href", url);
  $("#login_link").unbind("click");
  $("#login_link").click(function() {
    chrome.tabs.create({url: url});
    window.close();
    return false;
  });
  showView("login");
};

// Close the popup if the ESCAPE key is pressed.
window.addEventListener("keydown", function(e) {
  if (e.keyCode === 27) {
    window.close();
  }
}, /*capture=*/false);

$("#close-banner").click(function() { window.close(); });