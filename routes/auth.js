// ✅ Login Route (supports login with username OR email)
router.post("/login", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Require either username or email + password
    if ((!username && !email) || !password) {
      return res.status(400).json({ error: "Username/email and password are required" });
    }

    // Find user by username OR email
    const user = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Sign JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "supersecretkey123", {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("❌ Login Error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});