Rails.application.routes.draw do
  devise_for :users

  # Landing page (pública)
  root "landing#index"

  # Teste Flowbite
  get "flowbite-test", to: "pages#flowbite_test"

  # Dashboard (autenticado)
  get "dashboard", to: "dashboard#index"

  # Navegação pública
  get "explore", to: "explore#index"
  get "reading", to: "reading#index"
  get "categories", to: "categories#index"

  # Navegação autenticada
  get "library", to: "library#index"
  get "downloads", to: "downloads#index"
  get "favorites", to: "favorites#index"
  get "settings", to: "settings#index"

  # Books
  resources :books do
    member do
      patch :publish
      patch :unpublish
      get :read
      get :write
    end

    resources :chapters, only: [ :index, :show, :create, :update, :destroy ] do
      patch :reorder, on: :collection
    end
  end

  # Search
  get "search", to: "search#index"

  # Health check
  get "up" => "rails/health#show", as: :rails_health_check
end
