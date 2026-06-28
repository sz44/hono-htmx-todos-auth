import { Layout } from "./layout";

type AuthPageProps = {
  googleClientId?: string;
  googleLoginUri?: string;
};

const GoogleSignIn = ({ googleClientId, googleLoginUri }: AuthPageProps) => (
  <div class="my-4">
    {googleClientId && googleLoginUri ? (
      <>
        <script src="https://accounts.google.com/gsi/client" async defer></script>
        <div
          id="g_id_onload"
          data-client_id={googleClientId}
          data-login_uri={googleLoginUri}
          data-auto_prompt="false"
          data-use_fedcm_for_prompt="true"
        ></div>
        <div
          class="g_id_signin"
          data-type="standard"
          data-size="large"
          data-theme="outline"
          data-text="continue_with"
          data-shape="rectangular"
          data-logo_alignment="left"
        ></div>
      </>
    ) : null}
    <div class="mt-2">
      <a href="/auth/google" class="inline-block border p-2">
        Use Google redirect instead
      </a>
    </div>
  </div>
);

export const SignInPage = ({ googleClientId, googleLoginUri }: AuthPageProps) => (
  <Layout>
    <h1 class="text-2xl font-bold mb-4">Sign In</h1>
    <form hx-post="/signin">
      <input type="email" name="email" class="border p-2" placeholder="email" required />
      <input type="password" name="password" class="border p-2" placeholder="password" required />
      <button type="submit" class="bg-blue-500 text-white p-2">
        continue
      </button>
    </form>
    <GoogleSignIn googleClientId={googleClientId} googleLoginUri={googleLoginUri} />
    <div>
      <span>
        no account? <a href="/signup-email">sign up</a>
      </span>
    </div>
  </Layout>
);

export const SignUpPage = ({ googleClientId, googleLoginUri }: AuthPageProps) => (
  <Layout>
    <h1 class="text-2xl font-bold mb-4">Sign Up</h1>
    <form hx-post="/auth/signup-email">
      <input type="email" name="email" class="border p-2" placeholder="email" required />
      <input type="password" name="password" class="border p-2" placeholder="password" required />
      <button type="submit" class="bg-blue-500 text-white p-2">
        continue
      </button>
    </form>
    <GoogleSignIn googleClientId={googleClientId} googleLoginUri={googleLoginUri} />
    <div>
      <span>
        have an account? <a href="/">sign in</a>
      </span>
    </div>
  </Layout>
);
