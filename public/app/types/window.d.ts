export declare global {
  interface Window {
    __fermions_app_bundle_loaded: boolean;
    __fermions_public_path__: string;
    __fermions_load_failed: () => void;
    public_cdn_path: string;
    nonce: string | undefined;
  }
}
