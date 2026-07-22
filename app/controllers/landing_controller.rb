class LandingController < ApplicationController
  def index
    @featured_books = defined?(Book) ? Book.published.includes(:user).limit(8) : []
    @categories = defined?(Book) ? Book.published.group(:category).count : {}
  end
end
