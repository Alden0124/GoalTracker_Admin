export default {
  auth: {
    // Signup related
    signupSuccess: "Registration successful",
    signupFailed: "Registration failed, please try again later",
    emailRegistered: "This email is already registered",
    missingFields: "Please provide complete registration information",
    missingUsername: "Please provide a username",
    missingEmail: "Please provide an email",
    missingPassword: "Please provide a password",
    invalidEmail: "Invalid email format",
    invalidPassword: "Password must be at least 6 characters long",
    invalidUsername: "Username can only contain letters, numbers and underscores",
    emailNotVerified: "This email is not verified",
    // Login related
    loginSuccess: "Login successful",
    loginFailed: "Login failed, please try again later",
    emailNotRegistered: "This email is not registered",
    invalidPassword: "Invalid password",
    missingCredentials: "Please provide email and password",
    accountPasswordError: "Invalid account or password",
    thirdPartyLoginRequired: "This email uses {provider} login, please use the corresponding service",
    
    // Third-party login
    googleLoginSuccess: "Google login successful",
    lineLoginSuccess: "LINE login successful",
    unsupportedProvider: "Unsupported login method",
    missingProviderParams: "Missing required parameters",
    
    // Logout related
    logoutSuccess: "Logout successful",
    logoutError: "Error occurred during logout",
    missingLogoutToken: "No logout token provided",
    userNotFound: "User not found"
  },
  validation: {
    required: "{field} is required",
    invalidFormat: "{field} format is invalid"
  },
  error: {
    serverError: "Server error",
    unauthorized: "Unauthorized request"
  },
  goal: {
    missingFields: "Please provide goal title and start date",
    createSuccess: "Goal created successfully"
  }
}; 