class LibraryController < ApplicationController
  before_action :authenticate_user!

  def index
    @books = current_user.books.order(updated_at: :desc)
  end
end
