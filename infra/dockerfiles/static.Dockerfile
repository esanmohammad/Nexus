FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE {{PORT}}
