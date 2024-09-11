document.addEventListener("DOMContentLoaded", function() {
    var dropdown = document.getElementById("myDropdown");
    var hiddenOption = dropdown.querySelector("option[disabled][hidden]");
    var submitButton = document.querySelector(".inputbutton"); // Adjust the selector based on your class name

    document.addEventListener("click", function(event) {
        if (!dropdown.contains(event.target) && event.target !== submitButton) {
            dropdown.value = hiddenOption.value;
        }
    });
});

document.addEventListener("DOMContentLoaded", function() {
    var form = document.querySelector(".newsletter-form");
    var subscribeButton = form.querySelector(".newsletter-submit");
    var thankYouMessage = form.querySelector("#thankYouMessage");

    form.addEventListener("submit", function(event) {
        event.preventDefault(); // Prevent the form from submitting

        // Insert the thank you message next to the subscribe button
        var messageSpan = document.createElement("span");
        messageSpan.textContent = "Thank you. You will receive a confirmation email shortly.";
        messageSpan.className = "thank-you-message";
        subscribeButton.parentNode.insertBefore(messageSpan, subscribeButton.nextSibling);

        // Hide the message after 4 seconds
        setTimeout(function() {
            thankYouMessage.style.display = "null";
        }, 4000); // 4000 milliseconds = 4 seconds
    });
});
document.addEventListener("DOMContentLoaded", function() {
    var form = document.querySelector(".form-container");
    var dropdown = form.querySelector("#myDropdown");

    form.addEventListener("submit", function(event) {
        event.preventDefault(); // Prevent the form from submitting
        var selectedValue = dropdown.value;
        if (selectedValue) {
            window.location.href = selectedValue + ""; // Navigate to the selected option's link
        }
    });
});

document.getElementById('exhibitionForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the default form submission

    const selectedValue = document.getElementById('exhibitionDropdown').value;

    if (selectedValue) {
      window.location.href = selectedValue + ""; // Redirect to the selected path
    }
  });

  window.addEventListener('scroll', function() {
    var image = document.getElementById('.Amanita-img');
    var content = document.querySelector('.content');
    var threshold = content.getBoundingClientRect().bottom;
    
    if (window.scrollY > threshold) {
      image.classList.add('hidden');
    } else {
      image.classList.remove('hidden');
    }
  });
