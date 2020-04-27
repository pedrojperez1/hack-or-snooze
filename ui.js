$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $favoritedArticles = $('#favorited-articles');
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $userProfile = $('#user-profile');
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navCreatePost = $('#nav-post');
  const $navWelcome = $('#nav-welcome');
  const $navFavorites = $('#nav-favorites');
  const $navMyStories = $('#nav-mystories');

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for submitting a new post
   */
  $submitForm.on("submit", async function(evt) {
    evt.preventDefault();
    let author = $('#author').val();
    let title = $('#title').val();
    let url = $('#url').val();
    const newStory = await StoryList.addStory(
      currentUser, 
      new Story({ author, title, url })
    );
    const result = generateStoryHTML(newStory);
    $allStoriesList.append(result);
    currentUser.ownStories.push(newStory);
    location.reload();
  });
  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event Handler for Clicking welcome (profile name)
   */

  $navWelcome.on("click", function() {
    // Show the Login and Create Account Forms
    $allStoriesList.hide();
    $favoritedArticles.hide();
    $ownStories.hide();
    $userProfile.show();
    $('#profile-name').html(`<b>Name:</b> ${currentUser.name}`);
    $('#profile-username').html(`<b>Username:</b> ${currentUser.username}`);
    $('#profile-account-date').html(`<b>Account Created:</b> ${currentUser.createdAt}`);
  });

  /*
   * Event handler for clicking Create Post
   */
  $navCreatePost.on("click", function () {
    $submitForm.slideToggle();
  })

  /*
   * Event handler for clicking Favorites
   */
  $navFavorites.on("click", function () {
    generateFavorites();
    $allStoriesList.hide();
    $userProfile.hide();
    $ownStories.hide();
    $favoritedArticles.show();
  })

  /*
   * Event handler for clicking my stories
   */
  $navMyStories.on("click", function () {
    $allStoriesList.hide();
    $favoritedArticles.hide();
    $userProfile.hide();
    generateMyStories();
    $ownStories.toggle();
    console.log(currentUser);
  })

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function() {
    hideElements();
    await generateStories();
    $favoritedArticles.hide();
    $allStoriesList.show();
  });

  $("body").on("click", "i.favorite", async function () {
    let storyId = $(this).parent().attr("id");
    if ($(this).hasClass("far")) { // do this if not favorited yet
      $(this).removeClass("far").addClass("fas");
      currentUser.favorites = await currentUser.addFavorite(storyId);
      generateFavorites();
    } else {                      // do this if story already favorited
      $(this).removeClass("fas").addClass("far");
      currentUser.favorites = await currentUser.removeFavorite(storyId);
      generateFavorites();
    }
    
  });

  $("body").on("click", "span.trash-can", async function () {
    let storyId = $(this).parent().attr("id");
    let removedStory = await StoryList.removeStory(currentUser, storyId);
    currentUser.ownStories = currentUser.ownStories.filter(e => e.storyId !== storyId);
    currentUser.favorites = currentUser.favorites.filter(e => e.storyId !== storyId);
    generateMyStories();
  })

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");
    //generate favorites
    generateFavorites();
    //generate my stories
    generateMyStories();
    // show the stories
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

  function generateFavorites() {
    $favoritedArticles.empty();
    for (let story of currentUser.favorites) {
      const result = generateStoryHTML(story);
      $favoritedArticles.append(result);
    } 
  }

  function generateMyStories() {
    $ownStories.empty();
    for (let story of currentUser.ownStories) {
      const result = generateStoryHTML(story, true);
      $ownStories.append(result);
    }
  }
  
  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story, isMyStory=false) {
    let isFavorite = checkStoryIsFavorite(story.storyId);
    let trashIcon = `
      <span class="trash-can">
        <i class="fa fa-trash"></i>
      </span>`;
    let addTrashIcon = isMyStory ? trashIcon : '';
    let hostName = getHostName(story.url);
    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        ${addTrashIcon}
        <i class="${isFavorite ? "fas" : "far"} fa-star favorite"></i>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
      $userProfile
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $navWelcome.text(currentUser.username);
    $navWelcome.show();
    $navCreatePost.show();
    $navFavorites.show();
    $navMyStories.show();
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }

  /*
   * Checks if a storyId is a favorite of currentUser
   */
  function checkStoryIsFavorite(storyId) {
    if (currentUser) {
      let favorites = currentUser.favorites.map(e => e.storyId);
      return favorites.includes(storyId);
    } else {
      return false;
    }
    
  }
});
