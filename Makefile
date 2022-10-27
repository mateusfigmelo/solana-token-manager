.PHONY: install test-keys build start test clean-test-keys stop

TEST_KEY := $(shell solana-keygen pubkey ./tests/test-key.json)

all: install test-keys build start test clean-test-keys stop

install:
	yarn install

build:
	anchor build
	yarn idl:generate

start:
	solana-test-validator --url https://api.mainnet-beta.solana.com \
		--clone metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s --clone PwDiXFxQsGra4sFFTT8r1QWRMd4vfumiWC1jfWNfdYT \
		--clone pmvYY6Wgvpe3DEj3UX1FcRpMx43sMLYLJrFTVGcqpdn --clone 355AtuHH98Jy9XFg5kWodfmvSfrhcxYUKGoJe8qziFNY \
		--clone crkdpVWjHWdggGgBuSyAqSmZUmAjYLzD435tcLDRLXr \
		--bpf-program mgr99QFMYByTqGPWmNqunV7vBLmWWXdSrHUfV8Jf3JM ./target/deploy/cardinal_token_manager.so \
		--bpf-program pcaBwhJ1YHp7UDA7HASpQsRUmUNwzgYaLQto2kSj1fR ./target/deploy/cardinal_paid_claim_approver.so \
		--bpf-program tmeEDp1RgoDtZFtx6qod3HkbQmv9LMe36uqKVvsLTDE ./target/deploy/cardinal_time_invalidator.so \
		--bpf-program useZ65tbyvWpdYCLDJaegGK34Lnsi8S3jZdwx8122qp ./target/deploy/cardinal_use_invalidator.so \
		--bpf-program trsMRg3GzFSNgC3tdhbuKUES8YvGtUBbzp5fjxLtVQW ./target/deploy/cardinal_transfer_authority.so \
		--reset --quiet & echo $$! > validator.PID
	sleep 5
	solana-keygen pubkey ./tests/test-key.json
	solana airdrop 1000 $(TEST_KEY) --url http://localhost:8899

test:
	anchor test --skip-local-validator --skip-build --skip-deploy --provider.cluster localnet

stop:
	pkill solana-test-validator