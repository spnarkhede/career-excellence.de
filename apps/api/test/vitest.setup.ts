// AuthService (and anything importing it) calls loadPrivateEnv() at module load time,
// which throws if required vars are missing — before any individual test's own
// DB-reachability skip logic gets a chance to run. CI already sets real values for
// these in .github/workflows/ci.yml's job-level `env:` block, so this only fills gaps
// for a local run with no .env configured; `??=`-style "set only if unset" below means
// a real CI/local value always wins over this placeholder.
// A fixed test-only RSA keypair (generated once for this purpose, never used
// outside tests) — without it, AuthService generates a fresh ephemeral keypair
// per worker process on every test run, which is correct but makes a full test
// run noticeably slower (RSA keygen isn't cheap) for no benefit in a suite that
// never needs tokens to survive a restart anyway.
const TEST_JWT_PRIVATE_KEY =
  "-----BEGIN PRIVATE KEY-----\n" + // secret-scan-ignore-line: fake fixture, test-only keypair
  "MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDEUkCG7PfAZoe3\n" +
  "KyC17lb6STGCpg344pRmFdmCFs/z39nTuO5/K18HmUgCtVLftm3ECLlZgmuQJJ+P\n" +
  "iUMEhHT5YNvWt4gHNy7txpa2n+rfm72R9kYW8TaiTFM9SavGD/MbSANIS6JRKTR9\n" +
  "8Vy3Bdt8cdbNQG1lRGtOQIHKCzKiEoWe+zdFq9pMqiEod7RfYDDShRgw9ziIWMhr\n" +
  "+F0ApmflqvbJxVQ71vJ7xEl0ftCsl7uW7frLBVRLk7QvzRjFCm0OhzrCCdj+OMLJ\n" +
  "NDRKuKKV+812PUN5c0q8nuoji2iPmNTIjQrbXuW62yUHoEv4ul//hqfvoddMX4vB\n" +
  "a3Yuo/uRAgMBAAECggEAFxm0lQvKJT4LRx7QhQfL/TxikoR2jWwf2RlGFDwZ8RDM\n" +
  "gVC344fXcT30jrkGTOOa69+465LglD/y9IFKvPvXBccDZzMGUw8HuxvMfSW5DeG1\n" +
  "/zhSy/1LF/LSMpp6F16mFPY2yKl5qoImNpGRfsm2J2D/zPwBQ1K3K6iEfSEvLom5\n" +
  "QWSpW1eZcnFkbJkeKsJGMtrOrmvWYGtBLdFRbxWHb2CbgTYXxEVy8oDw8TgC2PBv\n" +
  "KgxKfuQIMB6OD/K9wohWin165PRa+1Rcm/6IiDuQ4Kamh82puKvdtd98Lal3/m7e\n" +
  "W+ihROcYB5yBspE8+fkKK/SMePPerzdy3SCKTe3spwKBgQD8/Dw57oXImIOEiCkH\n" +
  "rgI4/8DE34ZZLu5Dq7LZg4zPaeJ+EsA9YsJpLB3GrB2zqrwj2WuJtAF/P5cf6Kk5\n" +
  "Nt+yGOsmkMejB7bt5dziUwvcsqiCjIkDcTikb6f3qaEAPgmsYDixieUa6PAFzagF\n" +
  "/gkwK068bUCcoSFX9IBMfQk4WwKBgQDGqSfmpmiNsZmYOlc/S6+ib5cTlqxJFyIx\n" +
  "/PTAzp3rP0ejIV0g/oT8CslepG2o3lxT88WU4xO7JeOTYaeTfdSlyQqyGNE1sPKa\n" +
  "uzvyv8jBKrLHPOPJo9JD2LOfIT26K2MUMqZoCkW5iLesNl68J3l+aCeBoHpwGM5K\n" +
  "wPiG6ZV/gwKBgFN6A4F2JCzprlP3/dnr4A3gzkHoI9Ofub0Ylb5SOw9ht/uzwj0/\n" +
  "Ljk39mdM+cwEJWqK3oIkpG3RlNNRmS0o3y1MLaOfGFDCRek/9N+1WW+sgA/7wWYi\n" +
  "YPdZZIpDLb3/un9njK2Ae9miTTkNAElh5rQ/Rg7E2hIU1QTJx9/1TiqLAoGAWMh2\n" +
  "XZ1XMqQBmcfRACeqGbU3VnjLDGs7TA3ZsGVmrCD+uggKH9m/wwhrEFH59DNUHezf\n" +
  "C3gkdEotl8tX4hGlPGZJ0mhG73DiK4ar9wQBC1syxNoQjygYq1uoguCPPqlvQTKV\n" +
  "rf+RQ6a3N06hLgOSR4zywvreXUSoxT3SlDDGMFMCgYAeBccAfssPhpogSJlqjj3h\n" +
  "cQeENWDYIC0vPNjBMh+zJoD8x7uuQacuFTref461rhUTgwi5CbxlQmsz8dfQpHGA\n" +
  "BCbLeypThJX9F72HzYm77Bvir7gnmR2KCNOt5LJiryTsm48ixddafjmPBbdpCpPg\n" +
  "j8+qpzmOhSBTpsnSrfKKiA==\n" +
  "-----END PRIVATE KEY-----\n";
const TEST_JWT_PUBLIC_KEY =
  "-----BEGIN PUBLIC KEY-----\n" +
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxFJAhuz3wGaHtysgte5W\n" +
  "+kkxgqYN+OKUZhXZghbP89/Z07jufytfB5lIArVS37ZtxAi5WYJrkCSfj4lDBIR0\n" +
  "+WDb1reIBzcu7caWtp/q35u9kfZGFvE2okxTPUmrxg/zG0gDSEuiUSk0ffFctwXb\n" +
  "fHHWzUBtZURrTkCBygsyohKFnvs3RavaTKohKHe0X2Aw0oUYMPc4iFjIa/hdAKZn\n" +
  "5ar2ycVUO9bye8RJdH7QrJe7lu36ywVUS5O0L80YxQptDoc6wgnY/jjCyTQ0Srii\n" +
  "lfvNdj1DeXNKvJ7qI4toj5jUyI0K217lutslB6BL+Lpf/4an76HXTF+LwWt2LqP7\n" +
  "kQIDAQAB\n" +
  "-----END PUBLIC KEY-----\n";

const DEFAULTS: Record<string, string> = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/app_dev",
  REDIS_URL: "redis://localhost:6379",
  AUTH_JWT_SECRET: "local-test-only-placeholder-not-a-real-secret-32c", // secret-scan-ignore-line
  ENCRYPTION_KEY: "local-test-only-placeholder-key-32-bytes!!", // secret-scan-ignore-line
  AUTH_JWT_PRIVATE_KEY: TEST_JWT_PRIVATE_KEY,
  AUTH_JWT_PUBLIC_KEY: TEST_JWT_PUBLIC_KEY,
};

for (const [key, value] of Object.entries(DEFAULTS)) {
  if (!process.env[key]) process.env[key] = value;
}
