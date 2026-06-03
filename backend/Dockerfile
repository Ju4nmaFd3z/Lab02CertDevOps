FROM php:8.3-cli

# Instala dependencias del sistema y extensiones PHP necesarias
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
    && docker-php-ext-install pdo pdo_mysql zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copia Composer desde su imagen oficial
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copia primero solo composer.json para aprovechar la caché de capas de Docker:
# si no cambia composer.json, Docker reutiliza la capa del 'composer install'
COPY composer.json ./
RUN composer install --no-dev --no-interaction --no-scripts --prefer-dist

# Copia el resto del código fuente
COPY . .

# Regenera el autoloader incluyendo los ficheros de la aplicación
RUN composer dump-autoload --optimize

# Asegura permisos de escritura en los directorios que Laravel necesita
RUN chmod +x artisan \
    && mkdir -p storage/logs storage/framework/cache/data storage/framework/sessions storage/framework/views bootstrap/cache \
    && chmod -R 777 storage bootstrap/cache

EXPOSE 8000

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
