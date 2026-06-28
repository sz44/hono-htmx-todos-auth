import { Layout } from "./layout";

export const SignInPage = () => (
  <Layout>
    <h1 class="text-2xl font-bold mb-4">Sign In</h1>
    <form hx-post="/signin">
      <input type="email" name="email" class="border p-2" placeholder="email" required />
      <input type="password" name="password" class="border p-2" placeholder="password" required />
      <button type="submit" class="bg-blue-500 text-white p-2">
        continue
      </button>
    </form>
    <div class="my-4">
      <a href="/auth/google" class="inline-block border p-2">
        Continue with Google
      </a>
    </div>
    <div>
      <span>
        no account? <a href="/signup-email">sign up</a>
      </span>
    </div>
  </Layout>
);

export const SignUpPage = () => (
  <Layout>
    <h1 class="text-2xl font-bold mb-4">Sign Up</h1>
    <form hx-post="/auth/signup-email">
      <input type="email" name="email" class="border p-2" placeholder="email" required />
      <input type="password" name="password" class="border p-2" placeholder="password" required />
      <button type="submit" class="bg-blue-500 text-white p-2">
        continue
      </button>
    </form>
    <div class="my-4">
      <a href="/auth/google" class="inline-block border p-2">
        Continue with Google
      </a>
    </div>
    <div>
      <span>
        have an account? <a href="/">sign in</a>
      </span>
    </div>
  </Layout>
);
