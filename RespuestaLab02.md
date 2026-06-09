# Respuesta — Laboratorio 02: Dockerizando el Backend (Laravel + MySQL)

## docker-compose.yml

```yaml
services:
  db:
    image: mysql:8.0
    container_name: bookshelf-db-container
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=seriesrank123
      - MYSQL_DATABASE=bookshelf
    volumes:
      - ./bookshelf-db-data:/var/lib/mysql
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro

  backend:
    build: ./backend
    container_name: bookshelf-backend-container
    ports:
      - "8000:8000"
    environment:
      - APP_NAME=BookShelf
      - APP_ENV=local
      - APP_KEY=base64:GdyfN3aV2MMto3pURnEBS6bbwDPumawD1pOJ/KLu4+4=
      - APP_DEBUG=false
      - APP_URL=http://localhost:8000
      - DB_CONNECTION=mysql
      - DB_HOST=db
      - DB_PORT=3306
      - DB_DATABASE=bookshelf
      - DB_USERNAME=root
      - DB_PASSWORD=seriesrank123
    depends_on:
      - db

networks:
  default:
    name: bookshelf-network
```

---

## Problema encontrado: falta de `composer.lock` y advisories de seguridad

Al ejecutar `docker compose up --build -d` por primera vez, la build me falló en el paso del `composer install` con este error:

```
Your requirements could not be resolved to an installable set of packages.
  Problem 1
    - Root composer.json requires laravel/framework ^11.0 but these were not loaded,
      because they are affected by security advisories.
```

Le escribí a Manolo para preguntarle pero no recibí respuesta, así que tuve que investigar por mi cuenta.

**Causa:** el repositorio del laboratorio no incluye el fichero `composer.lock`. Sin él, Composer intenta resolver las versiones más recientes de las dependencias en el momento de la build. Al hacerlo, detecta que todas las versiones disponibles de `laravel/framework ^11.0` tienen avisos de seguridad activos y bloquea la instalación por defecto.

**Solución que apliqué:** desactivar el bloqueo por advisories en el `Dockerfile` antes del `composer install`:

```dockerfile
RUN composer config policy.advisories.block false \
    && composer install --no-dev --no-interaction --no-scripts --prefer-dist
```

Esto le indica a Composer que ignore los avisos de seguridad y proceda con la instalación. Es una solución temporal válida en un entorno de laboratorio local.

---

## Pregunta del Paso 5

> ¿Qué ocurre al borrar `bookshelf-db-data/` y volver a hacer `docker compose up -d`? ¿Por qué aparecen solo los libros de ejemplo?

Al borrar `bookshelf-db-data/` perdemos todos los datos que habíamos añadido, y al volver a levantar los contenedores solo aparecen los libros de ejemplo del `init.sql`.

Esto ocurre porque el bind mount `./bookshelf-db-data:/var/lib/mysql` hace que la carpeta de nuestro ordenador y la carpeta de datos de MySQL dentro del contenedor sean la misma. Al borrarla, para MySQL es como si nunca hubiera existido una base de datos, así que ejecuta el `init.sql` automáticamente y recrea todo desde cero con los datos de ejemplo.