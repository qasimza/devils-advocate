test-backend:
	pytest -v

test-frontend:
	cd frontend && npm test

test:
	make test-backend && make test-frontend