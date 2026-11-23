COMPOSE      = docker compose -f Transcendance/docker-compose.yml
COMPOSE_PROD = docker compose -f Transcendance/docker-compose.test.yml
ENV          = Transcendance/backend/.env
ENV_EXAMPLE  = Transcendance/backend/.env.example

all: up

# Create backend/.env from the example the first time
$(ENV):
	cp $(ENV_EXAMPLE) $(ENV)
	@echo "Created $(ENV) from $(ENV_EXAMPLE)"

# Fill JWT_SECRET with a random value if it is empty (other values are kept)
env: $(ENV)
	@if ! grep -q '^JWT_SECRET=.' $(ENV); then \
		secret=$$(openssl rand -hex 48); \
		awk -v s="$$secret" '/^JWT_SECRET=/{print "JWT_SECRET=" s; next} {print}' $(ENV) > $(ENV).tmp \
			&& mv $(ENV).tmp $(ENV); \
		echo "Generated JWT_SECRET in $(ENV)"; \
	fi

up: env
	$(COMPOSE) up --build -d -V --remove-orphans
	@echo "Open https://localhost:8443"

down:
	$(COMPOSE) down --remove-orphans

logs:
	$(COMPOSE) logs -f

clean: down

# Also deletes the database and the certificate volumes
fclean:
	$(COMPOSE) down -v --rmi local --remove-orphans

re: fclean all

# Guilherme's build version (no live reload)
prod: env
	$(COMPOSE_PROD) up --build -d --remove-orphans

.PHONY: all env up down logs clean fclean re prod
